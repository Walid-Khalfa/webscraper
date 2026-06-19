export async function mapWithConcurrency(items, limit, worker) {
  const safeLimit = Math.max(Number(limit) || 1, 1);
  const results = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;

      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = Promise.reject(error);
      }
    }
  }

  await Promise.allSettled(Array.from({ length: Math.min(safeLimit, items.length) }, () => runner()));
  return Promise.allSettled(results);
}

