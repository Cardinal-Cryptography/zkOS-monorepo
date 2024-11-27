const roundBalance = (balance: string) => {
  return balance
    .split('.')
    .map((value, index) => (index == 1 ? value.substring(0, 18) : value))
    .join('.');
};

export default roundBalance;
