import re
import json
import time
import random
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


BASE_URL = "https://www.card-gorilla.com/card/detail/{}"


def clean_text(text):
    if not text:
        return None
    return re.sub(r"\s+", " ", text).strip()


def to_int(value):
    if not value:
        return None
    nums = re.sub(r"[^\d]", "", value)
    return int(nums) if nums else None


def create_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,2200")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    return webdriver.Chrome(options=options)


def parse_card_detail_selenium(driver, card_id):
    url = BASE_URL.format(card_id)
    driver.get(url)

    wait = WebDriverWait(driver, 10)

    try:
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "strong.card")))
    except:
        return None

    try:
        name = clean_text(driver.find_element(By.CSS_SELECTOR, "strong.card").text)
        issuer = clean_text(driver.find_element(By.CSS_SELECTOR, "p.brand").text)
    except:
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
        "previous_month_spending_text": None,
        "previous_month_spending_amount": None,
        "brand": None,
        "summary_benefits": [],
        "detail_benefits": []
    }

    # 이벤트 문구
    try:
        event_el = driver.find_element(By.CSS_SELECTOR, "a.event_txt")
        data["event_text"] = clean_text(event_el.text)
    except:
        pass

    # 카드 이미지
    try:
        img_el = driver.find_element(By.CSS_SELECTOR, "div.card_img img")
        data["image_url"] = img_el.get_attribute("src")
    except:
        pass

    # 상단 요약 혜택
    try:
        dl_list = driver.find_elements(By.CSS_SELECTOR, "div.bnf1 dl")
        for dl in dl_list:
            try:
                category = clean_text(dl.find_element(By.CSS_SELECTOR, "dt").text)
            except:
                category = None

            try:
                value = clean_text(dl.find_element(By.CSS_SELECTOR, "dd strong").text)
            except:
                value = None

            try:
                desc = clean_text(dl.find_element(By.CSS_SELECTOR, "dd i").text)
            except:
                desc = None

            data["summary_benefits"].append({
                "category": category,
                "value": value,
                "description": desc
            })
    except:
        pass

    # 연회비 / 전월실적 / 브랜드
    try:
        fee_box = driver.find_element(By.CSS_SELECTOR, "div.bnf2")
        fee_text = clean_text(fee_box.text) or ""

        domestic_match = re.search(r"국내전용\s*([\d,]+)\s*원", fee_text)
        overseas_match = re.search(r"해외겸용\s*([\d,]+)\s*원", fee_text)

        if domestic_match:
            data["annual_fee_domestic"] = to_int(domestic_match.group(1))
        if overseas_match:
            data["annual_fee_overseas"] = to_int(overseas_match.group(1))

        dl_list = fee_box.find_elements(By.CSS_SELECTOR, "dl")
        for dl in dl_list:
            try:
                dt = clean_text(dl.find_element(By.CSS_SELECTOR, "dt").text)
            except:
                dt = ""

            dd_text = clean_text(dl.text)

            if dt == "전월실적":
                value = dd_text.replace("전월실적", "").strip() if dd_text else None
                data["previous_month_spending_text"] = value

                if value:
                    m = re.search(r"(\d[\d,]*)\s*만원", value)
                    if m:
                        data["previous_month_spending_amount"] = int(m.group(1).replace(",", "")) * 10000

        try:
            brand_el = fee_box.find_element(By.CSS_SELECTOR, "dd.c_brand")
            data["brand"] = clean_text(brand_el.text)
        except:
            pass

    except:
        pass

    # 상세 혜택
    try:
        detail_sections = driver.find_elements(By.CSS_SELECTOR, "article.cmd_con.benefit div.lst.bene_area > dl")
        for dl in detail_sections:
            try:
                benefit_type = clean_text(dl.find_element(By.CSS_SELECTOR, "dt .txt1").text)
            except:
                benefit_type = None

            try:
                section_title = clean_text(dl.find_element(By.CSS_SELECTOR, "dt i").text)
            except:
                section_title = None

            try:
                body_el = dl.find_element(By.CSS_SELECTOR, "dd .in_box")
                raw_text = clean_text(body_el.text)
                raw_html = body_el.get_attribute("innerHTML")
            except:
                raw_text = None
                raw_html = None

            data["detail_benefits"].append({
                "benefit_type": benefit_type,
                "section_title": section_title,
                "raw_text": raw_text,
                "raw_html": raw_html
            })
    except:
        pass

    return data


def crawl_cards(start_id=1, end_id=20):
    driver = create_driver()
    all_cards = []
    skipped_ids = []
    failed = []

    try:
        for card_id in range(start_id, end_id + 1):
            try:
                data = parse_card_detail_selenium(driver, card_id)

                if data and data.get("name"):
                    all_cards.append(data)
                    print(f"[OK] {card_id} - {data['name']}")
                else:
                    skipped_ids.append(card_id)
                    print(f"[SKIP] {card_id}")

                time.sleep(random.uniform(1.0, 2.0))

            except Exception as e:
                failed.append({"card_id": card_id, "error": str(e)})
                print(f"[ERROR] {card_id} - {e}")
                time.sleep(random.uniform(1.5, 3.0))
    finally:
        driver.quit()

    return all_cards, skipped_ids, failed


if __name__ == "__main__":
    cards, skipped, failed = crawl_cards(1, 3600)

    with open("card_gorilla_cards.json", "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)

    with open("card_gorilla_skipped.json", "w", encoding="utf-8") as f:
        json.dump(skipped, f, ensure_ascii=False, indent=2)

    with open("card_gorilla_failed.json", "w", encoding="utf-8") as f:
        json.dump(failed, f, ensure_ascii=False, indent=2)

    print("done")
    print("cards:", len(cards))
    print("skipped:", len(skipped))
    print("failed:", len(failed))