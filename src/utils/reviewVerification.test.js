import { filterVerifiedReviews, isVerifiedReview } from './reviewVerification';

describe('review verification helpers', () => {
  test('only verified reviews are kept for score aggregation', () => {
    const reviews = [
      { id: 'a', rating: 5, verified: true },
      { id: 'b', rating: 3, verified: false },
      { id: 'c', rating: 4 },
      { id: 'd', rating: 2, verified: true },
    ];

    const verified = filterVerifiedReviews(reviews);

    expect(verified.map((r) => r.id)).toEqual(['a', 'd']);
    expect(verified.every(isVerifiedReview)).toBe(true);
  });

  test('unverified reviews are treated as non-verified for UI display', () => {
    expect(isVerifiedReview({ verified: false })).toBe(false);
    expect(isVerifiedReview({})).toBe(false);
  });
});
