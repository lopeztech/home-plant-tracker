/**
 * Firestore emulator integration tests.
 *
 * These tests validate real Firestore behaviour (query ordering, merge
 * semantics, transaction support) that the in-memory mock cannot catch.
 *
 * Prerequisites:
 *   1. Start the emulator:
 *        docker compose -f docker-compose.emulator.yml up -d
 *   2. Run the tests:
 *        FIRESTORE_EMULATOR_HOST=localhost:8686 npx vitest run \
 *          --config integration/vitest.config.mjs integration/emulator.test.js
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Firestore } from '@google-cloud/firestore';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

// Skip the entire suite if the emulator is not running
const describeWithEmulator = EMULATOR_HOST ? describe : describe.skip;

let db;

describeWithEmulator('Firestore emulator integration tests', () => {
  beforeAll(() => {
    db = new Firestore({
      projectId: 'plant-tracker-test',
      // The client library auto-detects FIRESTORE_EMULATOR_HOST
    });
  });

  // Clear test data between tests
  beforeEach(async () => {
    const users = await db.collection('users').listDocuments();
    for (const doc of users) {
      const subs = await doc.listCollections();
      for (const sub of subs) {
        const subDocs = await sub.listDocuments();
        for (const sd of subDocs) await sd.delete();
      }
      await doc.delete();
    }
  });

  // ── Query ordering ──────────────────────────────────────────────────────────

  it('returns plants ordered by createdAt descending', async () => {
    const userId = 'test-user-1';
    const plantsCol = db.collection('users').doc(userId).collection('plants');

    await plantsCol.doc('p1').set({ name: 'Fern', createdAt: '2026-01-01T00:00:00.000Z' });
    await plantsCol.doc('p2').set({ name: 'Cactus', createdAt: '2026-03-01T00:00:00.000Z' });
    await plantsCol.doc('p3').set({ name: 'Rose', createdAt: '2026-02-01T00:00:00.000Z' });

    const snapshot = await plantsCol.orderBy('createdAt', 'desc').get();
    const names = snapshot.docs.map(d => d.data().name);

    expect(names).toEqual(['Cactus', 'Rose', 'Fern']);
  });

  // ── Merge semantics ─────────────────────────────────────────────────────────

  it('preserves existing fields when using set with merge', async () => {
    const userId = 'test-user-2';
    const ref = db.collection('users').doc(userId).collection('plants').doc('p1');

    await ref.set({ name: 'Fern', species: 'Nephrolepis', floor: 'ground' });
    await ref.set({ name: 'Updated Fern' }, { merge: true });

    const doc = await ref.get();
    const data = doc.data();

    expect(data.name).toBe('Updated Fern');
    expect(data.species).toBe('Nephrolepis');
    expect(data.floor).toBe('ground');
  });

  it('overwrites nested fields during merge', async () => {
    const userId = 'test-user-3';
    const ref = db.collection('users').doc(userId).collection('config').doc('floors');

    await ref.set({ floors: [{ id: 'g', name: 'Ground', rooms: [] }] });
    await ref.set({
      floors: [{ id: 'g', name: 'Ground Updated', rooms: [{ name: 'Kitchen' }] }],
    }, { merge: true });

    const doc = await ref.get();
    expect(doc.data().floors[0].name).toBe('Ground Updated');
    expect(doc.data().floors[0].rooms).toHaveLength(1);
  });

  // ── Document existence ──────────────────────────────────────────────────────

  it('reports non-existent documents correctly', async () => {
    const ref = db.collection('users').doc('nonexistent').collection('plants').doc('nope');
    const doc = await ref.get();
    expect(doc.exists).toBe(false);
  });

  // ── Auto-ID generation ──────────────────────────────────────────────────────

  it('generates unique IDs when using add()', async () => {
    const col = db.collection('users').doc('test-user-4').collection('plants');
    const doc1 = await col.add({ name: 'Fern' });
    const doc2 = await col.add({ name: 'Cactus' });

    expect(doc1.id).toBeTruthy();
    expect(doc2.id).toBeTruthy();
    expect(doc1.id).not.toBe(doc2.id);
  });

  // ── Delete behaviour ────────────────────────────────────────────────────────

  it('removes document on delete', async () => {
    const ref = db.collection('users').doc('test-user-5').collection('plants').doc('p1');
    await ref.set({ name: 'Fern' });
    await ref.delete();

    const doc = await ref.get();
    expect(doc.exists).toBe(false);
  });

  // ── User isolation ──────────────────────────────────────────────────────────

  it('isolates data between users', async () => {
    const user1Plants = db.collection('users').doc('user-1').collection('plants');
    const user2Plants = db.collection('users').doc('user-2').collection('plants');

    await user1Plants.doc('p1').set({ name: 'Fern' });
    await user2Plants.doc('p1').set({ name: 'Cactus' });

    const snap1 = await user1Plants.get();
    const snap2 = await user2Plants.get();

    expect(snap1.docs).toHaveLength(1);
    expect(snap1.docs[0].data().name).toBe('Fern');
    expect(snap2.docs).toHaveLength(1);
    expect(snap2.docs[0].data().name).toBe('Cactus');
  });

  // ── Watering log append pattern ─────────────────────────────────────────────

  it('correctly appends to arrays via merge', async () => {
    const ref = db.collection('users').doc('test-user-6').collection('plants').doc('p1');

    await ref.set({
      name: 'Fern',
      wateringLog: [{ date: '2026-01-01T00:00:00.000Z', note: '' }],
    });

    const doc = await ref.get();
    const existing = doc.data();
    const newLog = [...existing.wateringLog, { date: '2026-01-08T00:00:00.000Z', note: '' }];

    await ref.set({ wateringLog: newLog, lastWatered: '2026-01-08T00:00:00.000Z' }, { merge: true });

    const updated = await ref.get();
    expect(updated.data().wateringLog).toHaveLength(2);
    expect(updated.data().name).toBe('Fern'); // preserved via merge
  });
});
