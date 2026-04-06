

// ── POST /plants/:id/diagnostic ─────────────────────────────────────────────

describe('POST /plants/:id/diagnostic', () => {
  it('returns 404 for non-existent plant', async () => {
    const res = await request(app)
      .post('/plants/missing/diagnostic').set('Authorization', authHeader())
      .send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when imageBase64 is missing', async () => {
    store[plantPath('p1')] = { name: 'Fern', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .post('/plants/p1/diagnostic').set('Authorization', authHeader())
      .send({ mimeType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when mimeType is missing', async () => {
    store[plantPath('p1')] = { name: 'Fern', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .post('/plants/p1/diagnostic').set('Authorization', authHeader())
      .send({ imageBase64: 'abc' });
    expect(res.status).toBe(400);
  });
});
