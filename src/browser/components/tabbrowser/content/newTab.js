function isOverflown(element) {
  return element.scrollHeight > element.clientHeight;
}

const newTab = document.getElementById("tabs=mewtab-button");
const tabbar = document.getElementById("tabbrowser-tabs");

if (isOverflown(tabbar)) {
  newTab.style.position = 'fixed';
  newTab.style.bottom = '0';
}
else {
  newTab.style.position = 'auto'
}
