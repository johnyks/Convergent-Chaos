(() => {
  const printButton = document.getElementById('print-resume');
  printButton.hidden = false;
  printButton.addEventListener('click', () => window.print());
})();
