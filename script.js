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

    // Initial setup for the first leg (Leg 0)
    setupLegEventListeners(document.getElementById('leg_0'), 0);

    // Function to add a new strategy leg input block (Option or Future)
    function addStrategyLeg() {
        legCounter++;
        const newLegHtml = `
            <div class="option-leg" id="leg_${legCounter}">
                <h3>Leg ${legCounter + 1} <button class="remove-leg">Remove</button></h3>
                <label>Leg Type:</label>
                <input type="radio" name="legType_${legCounter}" value="option" checked> Option
                <input type="radio" name="legType_${legCounter}" value="future"> Future
                <br>

                <div class="option-inputs">
                    <label>Option Type:</label>
                    <input type="radio" name="optionType_${legCounter}" value="call" checked> Call
                    <input type="radio" name="optionType_${legCounter}" value="put"> Put
                    <br>
                    <label for="strike-price_${legCounter}">Strike Price:</label>
                    <input type="number" id="strike-price_${legCounter}" value="30000" step="100">
                    <br>
                    <label for="premium_${legCounter}">Premium (per option):</label>
                    <input type="number" id="premium_${legCounter}" value="1000" step="1">
                </div>

                <div class="future-inputs" style="display: none;">
                    <label for="entry-price_${legCounter}">Entry Price:</label>
                    <input type="number" id="entry-price_${legCounter}" value="30000" step="100">
                </div>

                <label>Action:</label>
                <input type="radio" name="action_${legCounter}" value="buy" checked> Buy
                <input type="radio" name="action_${legCounter}" value="sell"> Sell
                <br>

                <label for="quantity_${legCounter}">Quantity:</label>
                <input type="number" id="quantity_${legCounter}" value="1" min="1" required>
                <hr>
            </div>
        `;
        strategyLegsDiv.insertAdjacentHTML('beforeend', newLegHtml);
        const newLegDiv = document.getElementById(`leg_${legCounter}`);
        setupLegEventListeners(newLegDiv, legCounter);
    }

    // Function to set up event listeners for a new or existing leg
    function setupLegEventListeners(legDiv, index) {
        // Remove button listener
        legDiv.querySelector('.remove-leg')?.addEventListener('click', (e) => {
            e.target.closest('.option-leg').remove();
            updateLegNumbers();
        });

        // Leg Type radio button listeners
        legDiv.querySelectorAll(`input[name="legType_${index}"]`).forEach(radio => {
            radio.addEventListener('change', (e) => {
                const selectedType = e.target.value;
                const optionInputs = legDiv.querySelector('.option-inputs');
                const futureInputs = legDiv.querySelector('.future-inputs');

                if (selectedType === 'option') {
                    optionInputs.style.display = 'block';
                    futureInputs.style.display = 'none';
                    // Make option fields required
                    legDiv.querySelector(`#strike-price_${index}`).required = true;
                    legDiv.querySelector(`#premium_${index}`).required = true;
                    legDiv.querySelector(`#entry-price_${index}`).required = false;
                } else { // future
                    optionInputs.style.display = 'none';
                    futureInputs.style.display = 'block';
                    // Make future fields required
                    legDiv.querySelector(`#strike-price_${index}`).required = false;
                    legDiv.querySelector(`#premium_${index}`).required = false;
                    legDiv.querySelector(`#entry-price_${index}`).required = true;
                }
            });
        });
        // Ensure initial state is correct for the first leg on load
        const initialLegType = legDiv.querySelector(`input[name="legType_${index}"]:checked`).value;
        const optionInputs = legDiv.querySelector('.option-inputs');
        const futureInputs = legDiv.querySelector('.future-inputs');
        if (initialLegType === 'option') {
            optionInputs.style.display = 'block';
            futureInputs.style.display = 'none';
            legDiv.querySelector(`#strike-price_${index}`).required = true;
            legDiv.querySelector(`#premium_${index}`).required = true;
            legDiv.querySelector(`#entry-price_${index}`).required = false;
        } else {
            optionInputs.style.display = 'none';
            futureInputs.style.display = 'block';
            legDiv.querySelector(`#strike-price_${index}`).required = false;
            legDiv.querySelector(`#premium_${index}`).required = false;
            legDiv.querySelector(`#entry-price_${index}`).required = true;
        }
    }


    // Function to update leg numbers after removal
    function updateLegNumbers() {
        const legs = strategyLegsDiv.querySelectorAll('.option-leg');
        legs.forEach((leg, index) => {
            leg.id = `leg_${index}`;
            leg.querySelector('h3').innerHTML = `Leg ${index + 1} <button class="remove-leg">Remove</button>`;

            // Update names/ids for all inputs within the leg
            leg.querySelector(`input[name^="legType"]`).name = `legType_${index}`;
            leg.querySelector(`input[name^="legType"][value="future"]`).name = `legType_${index}`;

            leg.querySelector(`input[name^="optionType"]`).name = `optionType_${index}`;
            leg.querySelector(`input[name^="optionType"][value="put"]`).name = `optionType_${index}`;
            leg.querySelector(`input[id^="strike-price"]`).id = `strike-price_${index}`;
            leg.querySelector(`input[id^="premium"]`).id = `premium_${index}`;

            leg.querySelector(`input[id^="entry-price"]`).id = `entry-price_${index}`;

            leg.querySelector(`input[name^="action"]`).name = `action_${index}`;
            leg.querySelector(`input[name^="action"][value="sell"]`).name = `action_${index}`;

            leg.querySelector(`input[id^="quantity"]`).id = `quantity_${index}`;

            // Re-attach event listeners for the updated leg
            setupLegEventListeners(leg, index);
        });
        legCounter = legs.length > 0 ? legs.length - 1 : -1; // Reset leg counter to correct value
    }


    addLegButton.addEventListener('click', addStrategyLeg);

    calculateButton.addEventListener('click', () => {
        const underlyingPriceInitial = parseFloat(underlyingPriceInput.value); // Use this for setting chart range
        if (isNaN(underlyingPriceInitial) || underlyingPriceInitial <= 0) {
            alert("Please enter a valid positive underlying asset price.");
            return;
        }

        const legs = [];
        strategyLegsDiv.querySelectorAll('.option-leg').forEach((legDiv, index) => {
            const legType = legDiv.querySelector(`input[name="legType_${index}"]:checked`).value;
            const action = legDiv.querySelector(`input[name="action_${index}"]:checked`).value;
            const quantity = parseInt(legDiv.querySelector(`#quantity_${index}`).value);

            if (isNaN(quantity) || quantity <= 0) {
                alert(`Please ensure Quantity for Leg ${index + 1} is a valid positive number.`);
                return;
            }

            if (legType === 'option') {
                const optionType = legDiv.querySelector(`input[name="optionType_${index}"]:checked`).value;
                const strikePrice = parseFloat(legDiv.querySelector(`#strike-price_${index}`).value);
                const premium = parseFloat(legDiv.querySelector(`#premium_${index}`).value);

                if (isNaN(strikePrice) || isNaN(premium) || strikePrice <= 0 || premium < 0) {
                    alert(`Please ensure Strike Price and Premium for Option Leg ${index + 1} are valid positive numbers.`);
                    return;
                }
                legs.push({ type: 'option', optionType, action, strikePrice, premium, quantity });
            } else { // future
                const entryPrice = parseFloat(legDiv.querySelector(`#entry-price_${index}`).value);
                if (isNaN(entryPrice) || entryPrice <= 0) {
                    alert(`Please ensure Entry Price for Future Leg ${index + 1} is a valid positive number.`);
                    return;
                }
                legs.push({ type: 'future', action, entryPrice, quantity });
            }
        });

        if (legs.length === 0) {
            alert("Please add at least one strategy leg.");
            return;
        }

        // Determine price range for the chart
        let minPriceForRange = underlyingPriceInitial * 0.8; // Default lower bound
        let maxPriceForRange = underlyingPriceInitial * 1.2; // Default upper bound

        // Adjust range based on strikes if options are present
        const allStrikes = legs.filter(leg => leg.type === 'option').map(leg => leg.strikePrice);
        if (allStrikes.length > 0) {
            const minStrike = Math.min(...allStrikes);
            const maxStrike = Math.max(...allStrikes);
            minPriceForRange = Math.min(minPriceForRange, minStrike * 0.9); // Go a bit lower than min strike
            maxPriceForRange = Math.max(maxPriceForRange, maxStrike * 1.1); // Go a bit higher than max strike
        }

        const priceIncrement = (maxPriceForRange - minPriceForRange) / 200; // More data points for smoother curve
        if (priceIncrement <= 0) { // Handle cases where range is too small or invalid
            console.warn("Price range is too small or invalid, adjusting increment.");
            maxPriceForRange = minPriceForRange + 1000; // Add a fixed range
            if (minPriceForRange < 0) minPriceForRange = 0;
            const fallbackIncrement = (maxPriceForRange - minPriceForRange) / 200;
            if (fallbackIncrement <= 0) { // Still invalid
                alert("Cannot determine a valid price range for calculation. Please adjust inputs.");
                return;
            }
        }


        const prices = [];
        const payoffs = [];

        let currentMaxProfit = -Infinity;
        let currentMaxLoss = Infinity;
        const breakevens = new Set();

        for (let p = minPriceForRange; p <= maxPriceForRange; p += priceIncrement) {
            prices.push(p);
            let totalPayoff = 0;

            legs.forEach(leg => {
                let legPayoff = 0;
                if (leg.type === 'option') {
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
                } else { // future
                    if (leg.action === 'buy') {
                        legPayoff = (p - leg.entryPrice);
                    } else { // sell
                        legPayoff = (leg.entryPrice - p);
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
        // Handle unlimited cases
        if (currentMaxProfit === Infinity && currentMaxLoss === Infinity) {
            riskReward = 'Unlimited P/L (Error)'; // Should not happen in real strategies
        } else if (currentMaxProfit === Infinity) {
            riskReward = 'Unlimited Reward';
        } else if (currentMaxLoss === -Infinity) {
            riskReward = 'Unlimited Risk';
        } else if (currentMaxProfit > 0 && currentMaxLoss < 0) {
            riskReward = (currentMaxProfit / Math.abs(currentMaxLoss)).toFixed(2);
        } else if (currentMaxProfit > 0 && currentMaxLoss === 0) {
            riskReward = 'Unlimited Reward (Limited Risk)';
        } else if (currentMaxProfit === 0 && currentMaxLoss < 0) {
             riskReward = '0 (Limited Reward, Limited Risk)';
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
