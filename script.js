document.addEventListener('DOMContentLoaded', () => {
    const strategyLegsDiv = document.getElementById('strategy-legs');
    const addLegButton = document.getElementById('add-leg');
    const calculateButton = document.getElementById('calculate-strategy');
    const underlyingPriceInput = document.getElementById('underlying-price');
    const maxProfitSpan = document.getElementById('max-profit');
    const maxLossSpan = document.getElementById('max-loss');
    const breakevenSpan = document.getElementById('breakeven-points');
    const riskRewardSpan = document.getElementById('risk-reward');
    const ctx = document.getElementById('payoffChart').getContext('2d');
    let chart;
    let legCounter = 0; // To keep track of unique IDs for new legs

    // Function to add a new option leg input block
    function addOptionLeg() {
        legCounter++;
        const newLegHtml = `
            <div class="option-leg" id="leg_${legCounter}">
                <h3>Leg ${legCounter + 1} <button class="remove-leg">Remove</button></h3>
                <label>Option Type:</label>
                <input type="radio" name="optionType_${legCounter}" value="call" checked> Call
                <input type="radio" name="optionType_${legCounter}" value="put"> Put
                <br>
                <label>Action:</label>
                <input type="radio" name="action_${legCounter}" value="buy" checked> Buy
                <input type="radio" name="action_${legCounter}" value="sell"> Sell
                <br>
                <label for="strike-price_${legCounter}">Strike Price:</label>
                <input type="number" id="strike-price_${legCounter}" value="30000" step="100" required>
                <br>
                <label for="premium_${legCounter}">Premium (per option):</label>
                <input type="number" id="premium_${legCounter}" value="1000" step="1" required>
                <br>
                <label for="quantity_${legCounter}">Quantity:</label>
                <input type="number" id="quantity_${legCounter}" value="1" min="1" required>
                <hr>
            </div>
        `;
        strategyLegsDiv.insertAdjacentHTML('beforeend', newLegHtml);
        // Add event listener for the new remove button
        document.querySelector(`#leg_${legCounter} .remove-leg`).addEventListener('click', (e) => {
            e.target.closest('.option-leg').remove();
            updateLegNumbers(); // Re-number legs after removal
        });
    }

    // Function to update leg numbers after removal
    function updateLegNumbers() {
        const legs = strategyLegsDiv.querySelectorAll('.option-leg');
        legs.forEach((leg, index) => {
            leg.id = `leg_${index}`;
            leg.querySelector('h3').innerHTML = `Leg ${index + 1} <button class="remove-leg">Remove</button>`;
            leg.querySelector(`input[name^="optionType"]`).name = `optionType_${index}`;
            leg.querySelector(`input[name^="optionType"][value="put"]`).name = `optionType_${index}`;
            leg.querySelector(`input[name^="action"]`).name = `action_${index}`;
            leg.querySelector(`input[name^="action"][value="sell"]`).name = `action_${index}`;
            leg.querySelector(`input[id^="strike-price"]`).id = `strike-price_${index}`;
            leg.querySelector(`input[id^="premium"]`).id = `premium_${index}`;
            leg.querySelector(`input[id^="quantity"]`).id = `quantity_${index}`;
        });
        legCounter = legs.length -1; // Reset leg counter to correct value
    }


    addLegButton.addEventListener('click', addOptionLeg);

    calculateButton.addEventListener('click', () => {
        const underlyingPrice = parseFloat(underlyingPriceInput.value);
        if (isNaN(underlyingPrice) || underlyingPrice <= 0) {
            alert("Please enter a valid positive underlying asset price.");
            return;
        }

        const legs = [];
        strategyLegsDiv.querySelectorAll('.option-leg').forEach((legDiv, index) => {
            const optionType = legDiv.querySelector(`input[name="optionType_${index}"]:checked`).value;
            const action = legDiv.querySelector(`input[name="action_${index}"]:checked`).value;
            const strikePrice = parseFloat(legDiv.querySelector(`#strike-price_${index}`).value);
            const premium = parseFloat(legDiv.querySelector(`#premium_${index}`).value);
            const quantity = parseInt(legDiv.querySelector(`#quantity_${index}`).value);

            if (isNaN(strikePrice) || isNaN(premium) || isNaN(quantity) || strikePrice <= 0 || premium < 0 || quantity <= 0) {
                alert(`Please ensure all fields for Leg ${index + 1} are valid positive numbers.`);
                return;
            }

            legs.push({ optionType, action, strikePrice, premium, quantity });
        });

        if (legs.length === 0) {
            alert("Please add at least one option leg.");
            return;
        }

        // Determine price range for the chart
        const allStrikes = legs.map(leg => leg.strikePrice);
        const minStrike = Math.min(...allStrikes);
        const maxStrike = Math.max(...allStrikes);

        const priceRangeMin = Math.max(0, minStrike * 0.8); // 20% below lowest strike
        const priceRangeMax = maxStrike * 1.2; // 20% above highest strike
        const priceIncrement = (priceRangeMax - priceRangeMin) / 100; // 100 data points

        const prices = [];
        const payoffs = [];

        let currentMaxProfit = -Infinity;
        let currentMaxLoss = Infinity;
        const breakevens = new Set(); // Use a Set to store unique breakeven points

        for (let p = priceRangeMin; p <= priceRangeMax; p += priceIncrement) {
            prices.push(p);
            let totalPayoff = 0;

            legs.forEach(leg => {
                let legPayoff = 0;
                if (leg.optionType === 'call') {
                    if (leg.action === 'buy') {
                        legPayoff = Math.max(0, p - leg.strikePrice) - leg.premium;
                    } else { // sell
                        legPayoff = Math.min(0, leg.strikePrice - p) + leg.premium;
                    }
                } else { // put
                    if (leg.action === 'buy') {
                        legPayoff = Math.max(0, leg.strikePrice - p) - leg.premium;
                    } else { // sell
                        legPayoff = Math.min(0, p - leg.strikePrice) + leg.premium;
                    }
                }
                totalPayoff += legPayoff * leg.quantity;
            });

            payoffs.push(totalPayoff);
            currentMaxProfit = Math.max(currentMaxProfit, totalPayoff);
            currentMaxLoss = Math.min(currentMaxLoss, totalPayoff);
        }

        // Find break-even points (where payoff crosses zero)
        for (let i = 0; i < payoffs.length - 1; i++) {
            if (payoffs[i] * payoffs[i + 1] < 0) { // Sign change indicates a zero crossing
                // Linear interpolation for a more precise breakeven
                const x1 = prices[i];
                const y1 = payoffs[i];
                const x2 = prices[i + 1];
                const y2 = payoffs[i + 1];
                const interpolatedBreakeven = x1 - y1 * (x2 - x1) / (y2 - y1);
                breakevens.add(interpolatedBreakeven.toFixed(2)); // Store rounded
            } else if (payoffs[i] === 0) { // Exactly at zero
                breakevens.add(prices[i].toFixed(2));
            }
        }


        maxProfitSpan.textContent = currentMaxProfit.toFixed(2);
        maxLossSpan.textContent = currentMaxLoss.toFixed(2);
        breakevenSpan.textContent = breakevens.size > 0 ? Array.from(breakevens).join(', ') : 'None';

        let riskReward = 'N/A';
        if (currentMaxProfit > 0 && currentMaxLoss < 0) {
            riskReward = (currentMaxProfit / Math.abs(currentMaxLoss)).toFixed(2);
        } else if (currentMaxLoss === 0 && currentMaxProfit > 0) {
            riskReward = 'Unlimited';
        } else if (currentMaxProfit === 0 && currentMaxLoss < 0) {
            riskReward = '0';
        } else if (currentMaxProfit > 0 && currentMaxLoss === Infinity) { // Example: naked short call
             riskReward = 'Unlimited Risk';
        } else if (currentMaxProfit === Infinity && currentMaxLoss < 0) { // Example: naked long call
             riskReward = 'Unlimited Reward';
        }


        riskRewardSpan.textContent = riskReward;


        // Update Chart
        if (chart) {
            chart.destroy();
        }

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: prices.map(p => p.toFixed(0)), // Format labels for readability
                datasets: [{
                    label: 'Strategy P&L at Expiration',
                    data: payoffs,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    pointRadius: 0, // Hide points
                    fill: false,
                    segment: {
                        borderColor: ctx => {
                            const value = ctx.p1.parsed.y;
                            return value > 0 ? 'rgba(0, 128, 0, 1)' : 'rgba(255, 0, 0, 1)';
                        },
                        backgroundColor: ctx => {
                            const value = ctx.p1.parsed.y;
                            return value > 0 ? 'rgba(0, 128, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'category', // Use 'category' for string labels
                        title: {
                            display: true,
                            text: 'Underlying Asset Price at Expiration'
                        },
                        ticks: {
                            autoSkip: true,
                            maxTicksLimit: 20 // Limit number of ticks for cleaner display
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Profit/Loss ($)'
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `P&L: $${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    });
});
