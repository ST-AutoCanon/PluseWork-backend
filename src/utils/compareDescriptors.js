exports.compareDescriptors = (descriptor1, descriptor2) => {
  let distance = 0;

  distance = Math.sqrt(
    descriptor1.reduce(
      (sum, val, idx) => sum + Math.pow(val - descriptor2[idx], 2),
      0
    )
  );
  return distance;
};
