export function isVerifiedReview(review) {
  return review?.verified === true;
}

export function filterVerifiedReviews(reviews = []) {
  return (Array.isArray(reviews) ? reviews : []).filter(isVerifiedReview);
}
