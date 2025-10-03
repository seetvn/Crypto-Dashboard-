import asyncio
import httpx
from datetime import datetime
from typing import Any, Dict
from shared_utils import redis_instance as r,find_missing_ranges, find_missing_ranges
import json

COIN = "celo:0x765DE816845861e75A25fCA122bb6898B8B1282a"
DEFI_LLAMA_API = "https://coins.llama.fi"
BASE_URL = "https://api.llama.fi"

# -----------------
# Helper functions
# -----------------
def datetime_to_unix(dt_str: str) -> int:
    """
    Convert a datetime string (e.g. "2023-09-13 22:44:00") into
    a UNIX timestamp in SECONDS.
    """
    dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
    return int(dt.timestamp())  # seconds

def isCUSD(symbol: str) -> bool:
    return symbol.upper() == "CUSD"

def map_cusd_row(row: Any) -> Dict[str, Any]:
    return {
        "close_time": row[0] * 1000,
        "close": float(row[1]),
        "open_time": row[0] * 1000,
        "open": float(row[1]),
    }
# -----------------
# Main fetch function
# -----------------
async def fetch_cusd_chart(client: httpx.AsyncClient, 
                           start_ts: int, 
                           end_ts: int, 
                           step: str = "1h", 
                           verbose: bool = False):
    """
    Fetch cUSD historical prices from DeFiLlama using httpx if not cached.
    """
    key = f"{COIN}:{step}"

    # Always work in ms
    if start_ts < 1e12:  
        start_ts *= 1000
    if end_ts < 1e12:
        end_ts *= 1000

    # STEP 1: Query cached
    cached_raw = r.zrangebyscore(key, start_ts, end_ts)
    cached_points = [json.loads(x) for x in cached_raw]

    # STEP 2: Missing ranges (all in ms now)
    missing_ranges = find_missing_ranges(start_ts, end_ts, cached_points, step)
    if missing_ranges:
        print(f" ⚠️ ⚠️ Cache miss for {COIN} {step}, missing ranges: {missing_ranges} ⚠️ ⚠️")
    else:
        print(f"👅 👅 Cache hit for {COIN} {step}, no missing ranges 👅 👅")
        cached_points.sort(key=lambda p: p["close_time"])
        return cached_points

    # STEP 3: Fetch missing ranges from external API
    for s, e in missing_ranges:
        print(f"= = = Fetching {COIN} {step} from {s} to {e}= = =")

        # convert to seconds only for external call
        new_data = await api_fetch_cusd_chart(client, s // 1000, e // 1000, step)

        with r.pipeline() as pipe:
            for row in new_data:
                point = map_cusd_row(row)
                pipe.zadd(key, {json.dumps(point): point["close_time"]})
                cached_points.append(point)
            pipe.execute()

        await asyncio.sleep(0.1)

    cached_points = [p for p in cached_points if start_ts <= p["close_time"] <= end_ts]
    cached_points.sort(key=lambda p: p["close_time"])
    return cached_points


async def api_fetch_cusd_chart(client: httpx.AsyncClient, 
                               start_ts: int, 
                               end_ts: int, 
                               step: str = "1h", 
                               verbose: bool = False):
    """
    Fetch cUSD historical prices from DeFiLlama using httpx.
    Expects start_ts and end_ts in SECONDS.
    """

    # Parse step string into seconds
    unit = step[-1]
    value = int(step[:-1])
    print(value,unit)
    if unit == "h":
        step_seconds = value * 3600
    elif unit == "m":
        step_seconds = value * 60
    elif unit == "d":
        step_seconds = value * 86400
    elif unit == "w": 
        step_seconds = value * 7 * 86400
    elif unit == "M":  
        step_seconds = value * 30 * 86400
    else:
        raise ValueError("Step must end with 'h', 'm', 'd', 'w', or 'M'")


    # Compute span
    span = (end_ts - start_ts) // step_seconds
    span = min(span,200)
    print(f"span: {span}, step_seconds: {step_seconds}")

    print(f"Fetching cUSD chart from {start_ts} to {end_ts} with step {step} ({step_seconds} seconds) and span {span}")

    url = f"{DEFI_LLAMA_API}/chart/{COIN}?start={start_ts}&period={step}&span={span}"

    try:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        print(f"HTTP error {e.response.status_code} for {url}")
        try:
            print("Response body:", e.response.json())
        except Exception:
            print("Raw response:", e.response.text)
        return []


    if "coins" not in data or COIN not in data["coins"] or not data["coins"]:
        print("🫙🫙 No data found for cUSD in given range. 🫙🫙 ")
        return []

    prices = data["coins"][COIN].get("prices", [])
    results = [(p["timestamp"], p["price"]) for p in prices]

    if verbose:
        for ts, price in results:
            dt = datetime.fromtimestamp(ts)  # convert seconds to datetime
            print(f"{dt} -> {price:.4f}")
        print(f"Total data points fetched: {len(results)}")

    return results

async def fetch_cusd_price(client: httpx.AsyncClient) -> tuple[str, float]:
    """
    Fetch latest cUSD price from DeFiLlama.
    Returns (pair_name, price).
    """
    url = f"{DEFI_LLAMA_API}/prices/current/{COIN}"
    r = await client.get(url)
    r.raise_for_status()
    data = r.json()
    coin_data = data.get("coins", {}).get(COIN, {})
    return "cUSD/USD", coin_data.get("price")


async def get_protocol_tvl(client: httpx.AsyncClient,protocol: str):
    """
    Fetch total and chain-specific TVL for a given DeFi protocol from DeFiLlama
    """
    url = f"{BASE_URL}/protocol/{protocol}"
    print("Fetching TVL data from:", url)
    resp = await client.get(url)
    resp.raise_for_status()
    data = resp.json()
    chain_tvls = data.get("currentChainTvls", {})

    # Calculate total TVL
    total_tvl = sum(chain_tvls.values())

    return {
        "total_tvl": total_tvl,
        "chains": chain_tvls
    }

# Example usage
# if __name__ == "__main__":
#     async def main():
#         async with httpx.AsyncClient() as client:
#             result = await get_protocol_tvl(client,"aave")
#             print("Total TVL:", result["total_tvl"])
#             print("Breakdown by chain:")
#             for chain, tvl in result["chains"].items():
#                 print(f"  {chain}: {tvl}")
#     asyncio.run(main())
# -----------------
# Example usage
# -----------------
if __name__ == "__main__":
    async def main():
        start_str = "2023-09-13 22:44:00"
        end_str   = "2023-09-18 18:45:00"

        start = datetime_to_unix(start_str)  # seconds
        end   = datetime_to_unix(end_str)    # seconds

        async with httpx.AsyncClient() as client:
            await api_fetch_cusd_chart(client, start, end, step="8h", verbose=True)
            # my_coin_price = await fetch_cusd_price(client)
            # print(f"Current cUSD price: {my_coin_price}")

    asyncio.run(main())


