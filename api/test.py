from itertools import groupby
from operator import itemgetter

# 1. Define expected timestamps
expected = list(range(20, 61))  # [20, ..., 60]

# 2. Simulate what's in Redis (could be parsed from redis result)
present = [20, 21, 22, 34, 35, 36, 56, 57, 58, 59, 60]

# 3. Find missing
missing = [ts for ts in expected if ts not in present]
missing = [24,25,26,27,28,29,30,31,33,37,38,39,40,41,42,43,44,49,50,51,54,55]


# 4. Group missing into contiguous ranges
def group_into_ranges(timestamps):
    ranges = []
    for _, group in groupby(enumerate(timestamps), lambda x: x[1] - x[0]):
        group = list(map(itemgetter(1), group))
        ranges.append((group[0], group[-1]))
    return ranges

missing_ranges = group_into_ranges(missing)

print("Missing Ranges:", missing_ranges)
