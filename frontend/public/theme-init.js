(function () {
  try {
    var saved = localStorage.getItem("theme");
    var webApp = window.Telegram && window.Telegram.WebApp;
    var fromTelegram = webApp && webApp.initData ? webApp.colorScheme : null;
    var theme = saved === "light" || saved === "dark" ? saved : fromTelegram;
    if (theme) document.documentElement.dataset.theme = theme;
  } catch (e) {
    /* localStorage может быть недоступен в приватном режиме — остаёмся на системной теме */
  }
})();
