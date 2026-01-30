

export const epochToGMT = (epoch: number): string => {
  // detect seconds vs milliseconds
  const ms = epoch < 1e12 ? epoch * 1000 : epoch;

  return new Date(ms).toUTCString();
};