function main(params) {
  var message = 'No discount offers';

  if(params.numberOfPolicies >= 2 && params.monthsSinceLastClaim >= 24) {
    // Offer 10% discount if customer will increase their deductible
    message = 'You are an excellent driver and qualify for a 10% discount if you increase your deductible';
  }
  else if(params.monthsSinceLastClaim >= 12) {
    // offer 5% discount if customer will increase their deductible
    message = 'You are a great driver and qualify for a 5% discount if you increase your deductible';
  }
  else {
    message = 'You are on your way to getting a discount, so check back with us in a few weeks';
  }

  params.message = message;
  return params;
}
