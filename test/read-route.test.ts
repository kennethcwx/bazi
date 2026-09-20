/**
 * /api/read takes `question` from the network. A non-string used to reach the
 * tokenizer and throw (500); it must be treated as "no question" instead.
 */

import { describe, it, expect } from 'vitest';
import { POST } from '../app/api/read/route';

const birth = {
  year: 1975, month: 3, day: 9, hour: 7, minute: 0,
  timeZone: 'Asia/Shanghai', gender: 'male', useTrueSolarTime: false,
};
const post = (body: unknown) =>
  POST(new Request('http://x/api/read', { method: 'POST', body: JSON.stringify(body) }));

describe('/api/read question guard', () => {
  it('rejects a non-string question as missing, not as a crash', async () => {
    const res = await post({ ...birth, question: 123 });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBeUndefined();
  });

  it('still routes a real question', async () => {
    const res = await post({ ...birth, question: '我的感情大概是什么格局？', locale: 'zh' });
    expect(res.status).toBe(200);
  });
});
