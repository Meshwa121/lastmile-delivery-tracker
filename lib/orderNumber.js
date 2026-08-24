function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LM-${ts}-${rand}`;
}
module.exports = { generateOrderNumber };
