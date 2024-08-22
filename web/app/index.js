function $(id) {
  return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', function () {
  console.log("app running!");
})

document.getElementById('circuit-board-toggle').addEventListener('click', function() {
    document.getElementById('circuit-board-overlay').classList.toggle('active');
});

document.getElementById('close-circuit-board').addEventListener('click', function() {
    document.getElementById('circuit-board-overlay').classList.remove('active');
});