const nisabValues = {
  PKR: 114713,
  USD: 411,
  AED: 1510,
};

document
  .getElementById("zakatForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    const currency = document.querySelector(
      'input[name="currency"]:checked'
    ).value;
    const totalWealth = parseFloat(
      document.getElementById("totalWealth").value
    );
    const zakatRate = 0.025; // 2.5%

    const nisab = nisabValues[currency];

    let message;

    if (totalWealth <= nisab) {
      message = `<p>Your assets have not reached the Nisab (minimum amount) required for Zakat in ${currency}.</p>`;
    } else {
      const zakatDue = totalWealth * zakatRate;
      message = `<h3>Your due Zakat is<br/><span>${currency} ${zakatDue.toFixed(
        2
      )}</span></h3>`;
    }

    document.getElementById("result").innerHTML = message;
  });
