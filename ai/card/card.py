import re
import json
import time
import random
from typing import Optional, List, Dict, Any, Tuple

from bs4 import BeautifulSoup

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from selenium.common.exceptions import (
    TimeoutException,
    InvalidSessionIdException,
    WebDriverException,
    NoSuchElementException
)


BASE_URL = "https://www.card-gorilla.com/card/detail/{}"

OUTPUT_CARDS_JSON = "card_gorilla_cards.json"
OUTPUT_SKIPPED_JSON = "card_gorilla_skipped.json"
OUTPUT_FAILED_JSON = "card_gorilla_failed.json"
OUTPUT_PROGRESS_JSON = "card_gorilla_progress.json"

DISCONTINUED_KEYWORDS = [
    "신규발급이 중단된 카드입니다",
    "신규 발급이 중단된 카드입니다",
    "신규발급 중단",
    "신규 발급 중단",
    "발급 중단",
    "신규발급 불가",
    "신규 발급 불가",
    "판매 중단",
    "단종"
]

RESTART_EVERY = 120
MAX_RETRY_PER_CARD = 2
PAGE_LOAD_TIMEOUT = 15
SCRIPT_TIMEOUT = 15
WAIT_TIMEOUT = 8
SAVE_EVERY = 50


# =========================
# 공통 유틸
# =========================
def clean_text(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    text = re.sub(r"\xa0", " ", str(text))
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def clean_multiline_text(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    text = str(text).replace("\xa0", " ")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines) if lines else None


def to_int(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    nums = re.sub(r"[^\d]", "", value)
    return int(nums) if nums else None


def dedup_keep_order(items: List[str]) -> List[str]:
    result = []
    seen = set()
    for item in items:
        if item and item not in seen:
            result.append(item)
            seen.add(item)
    return result


def has_discontinued_text(text: Optional[str]) -> bool:
    text = clean_text(text) or ""
    return any(keyword in text for keyword in DISCONTINUED_KEYWORDS)


def safe_quit(driver):
    try:
        if driver:
            driver.quit()
    except Exception:
        pass


def parse_html(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def save_json(path: str, data: Any):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# =========================
# 드라이버 생성
# =========================
def create_driver():
    options = Options()
    options.page_load_strategy = "eager"

    options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,2200")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--lang=ko-KR")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-background-timer-throttling")
    options.add_argument("--disable-backgrounding-occluded-windows")
    options.add_argument("--disable-renderer-backgrounding")
    options.add_argument("--blink-settings=imagesEnabled=false")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/146.0.0.0 Safari/537.36"
    )

    prefs = {
        "profile.managed_default_content_settings.images": 2,
        "profile.default_content_setting_values.notifications": 2,
        "profile.default_content_setting_values.geolocation": 2,
    }
    options.add_experimental_option("prefs", prefs)

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
    driver.set_script_timeout(SCRIPT_TIMEOUT)
    return driver


# =========================
# HTML 파싱 함수
# =========================
def extract_apply_status_from_soup(soup: BeautifulSoup) -> Dict[str, Any]:
    candidates = []

    selectors = [
        "div.app_btn a",
        "div.app_btn span",
        "div.app_btn b",
        "p.inactive",
        "p.inactive span",
        "a.inactive",
        ".inactive"
    ]

    for selector in selectors:
        for el in soup.select(selector):
            txt = clean_text(el.get_text(" ", strip=True))
            if txt:
                candidates.append(txt)

    candidates = dedup_keep_order(candidates)
    apply_status_text = " | ".join(candidates) if candidates else None
    is_discontinued = has_discontinued_text(apply_status_text)

    return {
        "is_discontinued": is_discontinued,
        "discontinued_text": apply_status_text if is_discontinued else None,
        "apply_status_text": apply_status_text
    }


def extract_summary_benefits_from_soup(soup: BeautifulSoup) -> List[Dict[str, Optional[str]]]:
    results = []

    for dl in soup.select("div.bnf1 dl"):
        category = clean_text(dl.select_one("dt").get_text(" ", strip=True)) if dl.select_one("dt") else None
        value = clean_text(dl.select_one("dd strong").get_text(" ", strip=True)) if dl.select_one("dd strong") else None
        desc = clean_text(dl.select_one("dd i").get_text(" ", strip=True)) if dl.select_one("dd i") else None

        if category or value or desc:
            results.append({
                "category": category,
                "value": value,
                "description": desc
            })

    return results


def extract_fee_and_basic_info_from_soup(soup: BeautifulSoup) -> Dict[str, Any]:
    result = {
        "annual_fee_domestic": None,
        "annual_fee_overseas": None,
        "annual_fee_detail_text": None,
        "previous_month_spending_text": None,
        "previous_month_spending_amount": None,
        "brand": []
    }

    fee_box = soup.select_one("div.bnf2")
    if not fee_box:
        return result

    fee_text = clean_text(fee_box.get_text(" ", strip=True)) or ""

    domestic_match = re.search(r"국내전용\s*([\d,]+)\s*원", fee_text)
    overseas_match = re.search(r"해외겸용\s*([\d,]+)\s*원", fee_text)

    if domestic_match:
        result["annual_fee_domestic"] = to_int(domestic_match.group(1))
    if overseas_match:
        result["annual_fee_overseas"] = to_int(overseas_match.group(1))

    dls = fee_box.select("dl")
    for dl in dls:
        dt_el = dl.select_one("dt")
        dt = clean_text(dt_el.get_text(" ", strip=True)) if dt_el else ""
        dd_text = clean_text(" ".join(x.get_text(" ", strip=True) for x in dl.select("dd")))

        if dt == "전월실적":
            result["previous_month_spending_text"] = dd_text
            if dd_text == "없음":
                result["previous_month_spending_amount"] = 0
            elif dd_text:
                m = re.search(r"(\d[\d,]*)\s*만원", dd_text)
                if m:
                    result["previous_month_spending_amount"] = int(m.group(1).replace(",", "")) * 10000

    brand_dd = fee_box.select_one("dd.c_brand")
    if brand_dd:
        brands = []
        for span in brand_dd.select("span"):
            txt = clean_text(span.get_text(" ", strip=True))
            if txt:
                brands.append(txt)
            else:
                for cls in span.get("class", []):
                    brands.append(cls)
        result["brand"] = dedup_keep_order(brands)

    pop = soup.select_one(".el-popover")
    if pop:
        result["annual_fee_detail_text"] = clean_text(pop.get_text(" ", strip=True))

    return result

def extract_lines_from_text_block(text: Optional[str]) -> List[str]:
    text = clean_multiline_text(text)
    if not text:
        return []

    lines = []
    for line in text.splitlines():
        line = re.sub(r"^[\-\•\·]\s*", "", line).strip()
        line = clean_text(line)
        if line:
            lines.append(line)
    return lines


def extract_detail_sections_from_driver(driver) -> List[Dict[str, Any]]:
    results = []
    section_selector = "article.cmd_con.benefit div.lst.bene_area > dl"

    try:
        WebDriverWait(driver, 3).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, section_selector))
        )
    except TimeoutException:
        return results

    dls = driver.find_elements(By.CSS_SELECTOR, section_selector)
    section_count = len(dls)

    for idx in range(section_count):
        try:
            # 매 loop마다 다시 찾기 (DOM 갱신 대비)
            dls = driver.find_elements(By.CSS_SELECTOR, section_selector)
            if idx >= len(dls):
                break

            dl = dls[idx]

            category = None
            summary = None
            detail_lines = []
            items = []
            tables = []
            plain_text = None

            try:
                category = clean_text(
                    dl.find_element(By.CSS_SELECTOR, "dt .txt1").text
                )
            except NoSuchElementException:
                pass

            try:
                summary = clean_text(
                    dl.find_element(By.CSS_SELECTOR, "dt i").text
                )
            except NoSuchElementException:
                pass

            # 섹션 펼치기
            try:
                dt = dl.find_element(By.CSS_SELECTOR, "dt")
                driver.execute_script(
                    "arguments[0].scrollIntoView({block:'center'});", dt
                )
                time.sleep(0.15)

                cls = dl.get_attribute("class") or ""
                if "on" not in cls.split():
                    try:
                        dt.click()
                    except Exception:
                        driver.execute_script("arguments[0].click();", dt)
                    time.sleep(0.3)

                # 다시 참조
                dls = driver.find_elements(By.CSS_SELECTOR, section_selector)
                if idx >= len(dls):
                    break
                dl = dls[idx]

            except NoSuchElementException:
                pass

            # 펼쳐진 dd 내용 읽기
            dd_boxes = dl.find_elements(By.CSS_SELECTOR, "dd .in_box")
            if dd_boxes:
                dd_box = dd_boxes[0]

                p_elements = dd_box.find_elements(By.CSS_SELECTOR, "p")
                current_item = None

                if p_elements:
                    for p in p_elements:
                        raw_lines = extract_lines_from_text_block(p.text)
                        if not raw_lines:
                            continue

                        detail_lines.extend(raw_lines)

                        strong_elements = p.find_elements(By.CSS_SELECTOR, "strong")
                        title = None
                        if strong_elements:
                            title = clean_text(strong_elements[0].text)

                        if title:
                            current_item = {
                                "title": title,
                                "lines": []
                            }
                            items.append(current_item)

                            for line in raw_lines:
                                remain = line
                                if remain.startswith(title):
                                    remain = clean_text(remain[len(title):])
                                if remain:
                                    current_item["lines"].append(remain)
                        else:
                            if current_item is None:
                                current_item = {
                                    "title": None,
                                    "lines": []
                                }
                                items.append(current_item)
                            current_item["lines"].extend(raw_lines)
                else:
                    detail_lines = extract_lines_from_text_block(dd_box.text)

                for table in dd_box.find_elements(By.CSS_SELECTOR, "table"):
                    rows = []
                    for tr in table.find_elements(By.CSS_SELECTOR, "tr"):
                        cells = []
                        for cell in tr.find_elements(By.CSS_SELECTOR, "th, td"):
                            cell_text = clean_text(cell.text)
                            if cell_text:
                                cells.append(cell_text)
                        if cells:
                            rows.append(cells)
                    if rows:
                        tables.append(rows)

                plain_text = "\n".join(detail_lines) if detail_lines else clean_multiline_text(dd_box.text)

            if category or summary or detail_lines or items or tables or plain_text:
                results.append({
                    "category": category,
                    "summary": summary,
                    "detail_lines": detail_lines,
                    "items": items,
                    "tables": tables,
                    "plain_text": plain_text
                })

        except Exception:
            # 한 섹션 실패해도 카드 전체는 계속 진행
            continue

    return results

def extract_detail_sections_from_soup(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    results = []

    sections = soup.select("article.cmd_con.benefit div.lst.bene_area > dl")
    for dl in sections:
        dt = dl.select_one("dt")
        dd = dl.select_one("dd .in_box")

        category = clean_text(dt.select_one(".txt1").get_text(" ", strip=True)) if dt and dt.select_one(".txt1") else None
        summary = clean_text(dt.select_one("i").get_text(" ", strip=True)) if dt and dt.select_one("i") else None

        detail_lines = []
        items = []
        plain_text = None
        tables = []

        if dd:
            plain_text = clean_multiline_text(dd.get_text("\n", strip=True))
            if plain_text:
                detail_lines = extract_lines_from_text_block(plain_text)

            current_item = None
            for child in dd.children:
                if getattr(child, "name", None) == "p":
                    text_block = clean_multiline_text(child.get_text("\n", strip=True))
                    raw_lines = extract_lines_from_text_block(text_block)
                    if not raw_lines:
                        continue

                    strong = child.find("strong")
                    if strong:
                        title = clean_text(strong.get_text(" ", strip=True))
                        current_item = {
                            "title": title,
                            "lines": []
                        }
                        items.append(current_item)

                        for line in raw_lines:
                            remain = line
                            if title and remain.startswith(title):
                                remain = clean_text(remain[len(title):])
                            if remain:
                                current_item["lines"].append(remain)
                    else:
                        if current_item is None:
                            current_item = {
                                "title": None,
                                "lines": []
                            }
                            items.append(current_item)
                        current_item["lines"].extend(raw_lines)

                elif getattr(child, "name", None) == "table":
                    rows = []
                    for tr in child.select("tr"):
                        cells = [clean_text(td.get_text(" ", strip=True)) for td in tr.select("td, th")]
                        cells = [c for c in cells if c]
                        if cells:
                            rows.append(cells)
                    if rows:
                        tables.append(rows)

        if category or summary or detail_lines or items or plain_text or tables:
            results.append({
                "category": category,
                "summary": summary,
                "detail_lines": detail_lines,
                "items": items,
                "tables": tables,
                "plain_text": plain_text
            })

    return results

def extract_disclaimers_from_soup(soup: BeautifulSoup) -> Dict[str, List[str]]:
    result = {
        "legal_disclaimers": [],
        "basic_notices": []
    }

    for box in soup.select("div.lst_info.inner"):
        lines = []
        for p in box.select("p"):
            txt = clean_text(p.get_text(" ", strip=True))
            if txt:
                lines.append(txt)

        if lines:
            result["legal_disclaimers"].extend(lines)

    basic_box = soup.select_one("div.lst_info.inner.basic")
    if basic_box:
        raw = clean_multiline_text(basic_box.get_text("\n", strip=True))
        if raw:
            result["basic_notices"].append(raw)

    result["legal_disclaimers"] = dedup_keep_order(result["legal_disclaimers"])
    result["basic_notices"] = dedup_keep_order(result["basic_notices"])
    return result


# =========================
# 카드 상세 페이지 파싱
# =========================
def parse_card_detail_selenium(driver, card_id: int) -> Optional[Dict[str, Any]]:

    url = BASE_URL.format(card_id)
    driver.get(url)

    wait = WebDriverWait(driver, WAIT_TIMEOUT)

    try:
        wait.until(
            EC.any_of(
                EC.presence_of_element_located((By.CSS_SELECTOR, "strong.card")),
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.card_top")),
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.bnf2")),
                EC.presence_of_element_located((By.CSS_SELECTOR, "article.cmd_con.benefit"))
            )
        )
    except TimeoutException:
        pass

    html = driver.page_source
    soup = parse_html(html)

    # 카드 상세 DOM 없으면 바로 SKIP
    if not has_card_detail_signal(soup):
        return None

    if is_missing_card_page(soup):
        return None

    name, issuer = extract_card_name_and_issuer(soup)

    if not name:
        return None

    data = {
        "card_id": card_id,
        "url": url,
        "name": name,
        "issuer": issuer,
        "event_text": None,
        "image_url": None,
        "annual_fee_domestic": None,
        "annual_fee_overseas": None,
        "annual_fee_detail_text": None,
        "previous_month_spending_text": None,
        "previous_month_spending_amount": None,
        "brand": [],
        "summary_benefits": [],
        "detail_sections": [],
        "is_discontinued": False,
        "discontinued_text": None,
        "apply_status_text": None,
        "legal_disclaimers": [],
        "basic_notices": []
    }

    event_el = soup.select_one("a.event_txt")
    if event_el:
        data["event_text"] = clean_text(event_el.get_text(" ", strip=True))

    img_el = soup.select_one("div.card_img img")
    if img_el:
        data["image_url"] = clean_text(img_el.get("src"))

    status_info = extract_apply_status_from_soup(soup)
    data["is_discontinued"] = status_info["is_discontinued"]
    data["discontinued_text"] = status_info["discontinued_text"]
    data["apply_status_text"] = status_info["apply_status_text"]

    data["summary_benefits"] = extract_summary_benefits_from_soup(soup)

    basic_info = extract_fee_and_basic_info_from_soup(soup)
    data.update(basic_info)

    # 핵심: Selenium으로 펼쳐가며 상세 수집
    detail_sections = extract_detail_sections_from_driver(driver)

    # fallback
    if not detail_sections:
        detail_sections = extract_detail_sections_from_soup(soup)

    data["detail_sections"] = detail_sections

    disclaimers = extract_disclaimers_from_soup(soup)
    data["legal_disclaimers"] = disclaimers["legal_disclaimers"]
    data["basic_notices"] = disclaimers["basic_notices"]

    return data

def is_missing_card_page(soup: BeautifulSoup) -> bool:

    body_text = clean_text(soup.get_text(" ", strip=True)) or ""

    missing_keywords = [
        "존재하지 않는",
        "잘못된 접근",
        "찾을 수 없습니다",
        "없는 페이지",
        "page not found"
    ]

    if has_card_detail_signal(soup):
        return False

    lower_text = body_text.lower()

    return any(keyword.lower() in lower_text for keyword in missing_keywords)

INVALID_CARD_NAMES = {
    "카드고를때, 카드고릴라",
    "카드고릴라",
    "cardgorilla",
    "카드"
}

def normalize_card_name(name: Optional[str]) -> Optional[str]:
    name = clean_text(name)
    if not name:
        return None

    if name in INVALID_CARD_NAMES:
        return None

    if "카드고릴라" == name.strip():
        return None

    return name

def extract_card_name_and_issuer(soup: BeautifulSoup):

    name = None
    issuer = None

    name_el = soup.select_one("strong.card")
    issuer_el = soup.select_one("p.brand")

    if name_el:
        name = normalize_card_name(name_el.get_text(" ", strip=True))

    if issuer_el:
        issuer = clean_text(issuer_el.get_text(" ", strip=True))

    if not name:
        og_title = soup.select_one("meta[property='og:title']")
        if og_title and og_title.get("content"):
            content = clean_text(og_title["content"])
            if content:
                extracted = re.sub(r"\s*(?:-|\|)\s*카드고릴라.*$", "", content).strip()
                name = normalize_card_name(extracted)

    # title fallback은 실제 카드 상세 DOM 있을 때만
    if not name and has_card_detail_signal(soup):
        title_el = soup.select_one("title")
        if title_el:
            title_text = clean_text(title_el.get_text(" ", strip=True))
            if title_text:
                m = re.search(r"카드고릴라\s*-\s*(.+)", title_text)
                if m:
                    name = normalize_card_name(m.group(1))

    return name, issuer

# =========================
# 단일 카드 안전 크롤링
# =========================
def crawl_one_card_with_retry(driver, card_id: int) -> Tuple[Optional[Dict[str, Any]], Any, Optional[str]]:
    last_error = None

    for attempt in range(1, MAX_RETRY_PER_CARD + 1):
        try:
            data = parse_card_detail_selenium(driver, card_id)
            return data, driver, None

        except InvalidSessionIdException as e:
            last_error = f"InvalidSessionIdException: {e}"
            safe_quit(driver)
            driver = create_driver()
            time.sleep(random.uniform(0.8, 1.4))

        except WebDriverException as e:
            last_error = f"WebDriverException: {e}"
            safe_quit(driver)
            driver = create_driver()
            time.sleep(random.uniform(0.8, 1.4))

        except Exception as e:
            last_error = f"Exception: {e}"
            if attempt < MAX_RETRY_PER_CARD:
                time.sleep(random.uniform(0.7, 1.1))
            else:
                return None, driver, last_error

    return None, driver, last_error


# =========================
# 카드 일괄 크롤링
# =========================
def crawl_cards(start_id=1, end_id=20):
    driver = create_driver()
    all_cards = []
    skipped_ids = []
    failed = []

    try:
        for idx, card_id in enumerate(range(start_id, end_id + 1), start=1):
            if idx > 1 and idx % RESTART_EVERY == 0:
                print(f"[INFO] driver restart at idx={idx}, card_id={card_id}")
                safe_quit(driver)
                driver = create_driver()
                time.sleep(random.uniform(0.5, 1.0))

            data, driver, error = crawl_one_card_with_retry(driver, card_id)

            if error:
                failed.append({
                    "card_id": card_id,
                    "error": error
                })
                print(f"[ERROR] {card_id} - {error}")
                time.sleep(random.uniform(0.7, 1.2))
                continue

            if data and data.get("name"):
                all_cards.append(data)
                discontinued_mark = " [중단]" if data.get("is_discontinued") else ""
                print(f"[OK] {card_id} - {data['name']}{discontinued_mark}")
            else:
                skipped_ids.append(card_id)
                print(f"[SKIP] {card_id}")

            if idx % SAVE_EVERY == 0:
                save_json(OUTPUT_CARDS_JSON, all_cards)
                save_json(OUTPUT_SKIPPED_JSON, skipped_ids)
                save_json(OUTPUT_FAILED_JSON, failed)
                save_json(OUTPUT_PROGRESS_JSON, {
                    "last_processed_id": card_id,
                    "processed_count": idx,
                    "cards_count": len(all_cards),
                    "skipped_count": len(skipped_ids),
                    "failed_count": len(failed)
                })
                print(f"[SAVE] progress saved at card_id={card_id}")

            time.sleep(random.uniform(0.25, 0.55))

    finally:
        safe_quit(driver)

    return all_cards, skipped_ids, failed

def has_card_detail_signal(soup: BeautifulSoup) -> bool:
    selectors = [
        "strong.card",
        "div.card_top",
        "div.card_img img",
        "div.bnf1",
        "div.bnf2",
        "article.cmd_con.benefit"
    ]
    return any(soup.select_one(selector) for selector in selectors)

# =========================
# 실행
# =========================
if __name__ == "__main__":
    cards, skipped, failed = crawl_cards(1, 3000)

    save_json(OUTPUT_CARDS_JSON, cards)
    save_json(OUTPUT_SKIPPED_JSON, skipped)
    save_json(OUTPUT_FAILED_JSON, failed)
    save_json(OUTPUT_PROGRESS_JSON, {
        "last_processed_id": 3000,
        "processed_count": 3000,
        "cards_count": len(cards),
        "skipped_count": len(skipped),
        "failed_count": len(failed),
        "done": True
    })

    print("done")
    print("cards:", len(cards))
    print("skipped:", len(skipped))
    print("failed:", len(failed))