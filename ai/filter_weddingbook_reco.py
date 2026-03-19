import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
JSON_DIR = ROOT / "json"

LIST_CANDIDATES = [
    Path(r"C:\Users\SSAFY\AppData\Local\Programs\Microsoft VS Code\weddingbook_halls_list.json"),
    JSON_DIR / "weddingbook_halls_list.json",
]

DETAIL_CANDIDATES = [
    Path(r"C:\Users\SSAFY\AppData\Local\Programs\Microsoft VS Code\weddingbook_halls_detail.json"),
    JSON_DIR / "weddingbook_halls_detail.json",
]

OUTPUT_LIST = JSON_DIR / "weddingbook_halls_reco_list.json"
OUTPUT_DETAIL = JSON_DIR / "weddingbook_halls_reco_detail.json"


def pick_latest_existing(paths):
    existing = [path for path in paths if path.exists()]
    if not existing:
        raise FileNotFoundError(f"No input file found in: {paths}")
    return max(existing, key=lambda path: path.stat().st_mtime)


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def has_name(item):
    return bool((item.get("partnerProfileName") or "").strip())


def has_region(item):
    return bool((item.get("region") or "").strip()) and bool((item.get("subRegion") or "").strip())


def has_price(item):
    price_keys = ["minMealPrice", "minRentalPrice", "minIndividualHallPrice"]
    return any((item.get(key) or 0) > 0 for key in price_keys)


def is_bookable(item):
    return bool(item.get("bookingState"))


def should_keep(item):
    return has_name(item) and has_region(item) and has_price(item) and is_bookable(item)


def main():
    list_path = pick_latest_existing(LIST_CANDIDATES)
    detail_path = pick_latest_existing(DETAIL_CANDIDATES)

    list_data = load_json(list_path)
    detail_data = load_json(detail_path)

    filtered_list = [item for item in list_data if should_keep(item)]
    keep_uuids = {item.get("partnerUuid") for item in filtered_list if item.get("partnerUuid")}
    filtered_detail = [item for item in detail_data if item.get("uuid") in keep_uuids]

    OUTPUT_LIST.write_text(json.dumps(filtered_list, ensure_ascii=False, indent=2), encoding="utf-8")
    OUTPUT_DETAIL.write_text(json.dumps(filtered_detail, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"list_source={list_path}")
    print(f"detail_source={detail_path}")
    print(f"total_list={len(list_data)}")
    print(f"reco_list={len(filtered_list)}")
    print(f"reco_detail={len(filtered_detail)}")
    print(f"output_list={OUTPUT_LIST}")
    print(f"output_detail={OUTPUT_DETAIL}")


if __name__ == "__main__":
    main()
