const TAB_CODE = 9;

document.addEventListener('keyup', e => {
  if (e.keyCode === TAB_CODE && !e.altKey && !e.ctrlKey) {
    document.documentElement.classList.add('is-keyboard-navigation');
  }
});

document.addEventListener('click', () => {
  document.documentElement.classList.remove('is-keyboard-navigation');
});
