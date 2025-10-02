import asyncio
import httpx
from datetime import datetime
from typing import Any, Dict

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
        "close": float(row[1])
    }
# -----------------
# Main fetch function
# -----------------
async def fetch_cusd_chart(client: httpx.AsyncClient, start_ts: int, end_ts: int, step: str = "1h", verbose: bool = False):
    """
    Fetch cUSD historical prices from DeFiLlama using httpx.
    Expects start_ts and end_ts in SECONDS.
    """
    if start_ts > 1e12:  
        start_ts //= 1000
    if end_ts > 1e12:
        end_ts //= 1000
    coin = "celo:0x765DE816845861e75A25fCA122bb6898B8B1282a"

    # Parse step string into seconds
    unit = step[-1].lower()
    value = int(step[:-1])
    if unit == "h":
        step_seconds = value * 3600
    elif unit == "m":
        step_seconds = value * 60
    elif unit == "d":
        step_seconds = value * 86400
    else:
        raise ValueError("Step must end with 'h', 'm', or 'd'")

    # Compute span
    span = (end_ts - start_ts) // step_seconds
    print(f"span: {span}, step_seconds: {step_seconds}")

    print(f"Fetching cUSD chart from {start_ts} to {end_ts} with step {step} ({step_seconds} seconds)")
    print(f" these are all the params: start={start_ts}, period={step}, span={span}")

    url = f"https://coins.llama.fi/chart/{coin}?start={start_ts}&period={step}&span={span}"

    try:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP error {e.response.status_code} for {url}")
        try:
            print("Response body:", e.response.json())
        except Exception:
            print("Raw response:", e.response.text)
        return []


    if "coins" not in data or coin not in data["coins"]:
        if verbose:
            print("⚠️ No data found for cUSD in given range.")
        return []

    prices = data["coins"][coin].get("prices", [])
    results = [(p["timestamp"], p["price"]) for p in prices]

    if verbose:
        for ts, price in results:
            dt = datetime.fromtimestamp(ts)  # convert seconds to datetime
            print(f"{dt} -> {price:.4f}")
        print(f"✅ Total data points fetched: {len(results)}")

    return results


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
            await fetch_cusd_chart(client, start, end, step="8h", verbose=False)

    asyncio.run(main())


