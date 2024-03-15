document
  .getElementById("zakatForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    const totalWealth = document.getElementById("totalWealth").value;
    const zakatRate = 0.025; // 2.5%
    const zakatDue = totalWealth * zakatRate;

    document.getElementById(
      "result"
    ).innerHTML = `<h3>Your Zakat is<br/><span>${zakatDue.toFixed(
      2
    )}</span></h3>`;
  });
