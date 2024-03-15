const nisabValues = {
  PKR: 114713,
  USD: 411,
  AED: 1510,
};

document
  .getElementById("zakatForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    // Get selected currency
    const currency = document.querySelector(
      'input[name="currency"]:checked'
    ).value;
    const totalWealth = parseFloat(
      document.getElementById("totalWealth").value
    );
    const zakatRate = 0.025; // 2.5%

    // Get the Nisab value for the selected currency
    const nisab = nisabValues[currency];

    let message; // This will store the message to be displayed to the user

    if (totalWealth <= nisab) {
      // If total wealth is equal to or less than the Nisab
      message = `<h3>You are not eligible for Zakat</h3><p>Your assets have not reached the Nisab (minimum amount) required for Zakat in ${currency}.</p>`;
    } else {
      // If total wealth is above the Nisab, calculate Zakat
      const zakatDue = totalWealth * zakatRate;
      message = `<h3>Your due Zakat is<br/><span>${currency} ${zakatDue.toFixed(
        2
      )}</span></h3>`;
    }

    document.getElementById("result").innerHTML = message;
  });
