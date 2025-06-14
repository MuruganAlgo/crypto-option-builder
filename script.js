document.addEventListener('DOMContentLoaded', () => {
    const strategyLegsDiv = document.getElementById('strategy-legs');
    const addLegButton = document.getElementById('add-leg');
    const calculateButton = document.getElementById('calculate-strategy');
    const clearLegsButton = document.getElementById('clear-legs'); // New clear button
    const underlyingPriceInput = document.getElementById('underlying-price');
    const maxProfitSpan = document.getElementById('max-profit');
    const maxLossSpan = document.getElementById('max-loss');
    const breakevenSpan = document.getElementById('breakeven-points');
    const riskRewardSpan = document.getElementById('risk-reward');
    const ctx = document.getElementById('payoffChart').getContext('2d');
    const strategyListElement = document.getElementById('strategy-list'); // For pre-built list

    let chart;
    let legCounter = 0; // To keep track of unique IDs for new legs

    // --- Pre-built Strategy Definitions ---
    // strikeRelative: 'ATM', 'OTM', 'ITM'
    // premiumFactor: A multiplier for the underlying price to get a placeholder premium
    // offset: Absolute price difference for OTM/ITM strikes
    const PREBUILT_STRATEGIES = {
        "Long Call": [
            { type: 'option', optionType: 'call', action: 'buy', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 }
        ],
        "Short Call": [
            { type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 }
        ],
        "Long Put": [
            { type: 'option', optionType: 'put', action: 'buy', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 }
        ],
        "Short Put": [
            { type: 'option', optionType: 'put', action: 'sell', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 }
        ],
        "Long Straddle": [
            { type: 'option', optionType: 'call', action: 'buy', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'buy', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 }
        ],
        "Short Straddle": [
            { type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'sell', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 }
        ],
        "Long Strangle": [
            { type: 'option', optionType: 'call', action: 'buy', strikeRelative: 'OTM_CALL', premiumFactor: 0.02, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'buy', strikeRelative: 'OTM_PUT', premiumFactor: 0.02, quantity: 1 }
        ],
        "Short Strangle": [
            { type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'OTM_CALL', premiumFactor: 0.02, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'sell', strikeRelative: 'OTM_PUT', premiumFactor: 0.02, quantity: 1 }
        ],
        "Bull Call Spread": [
            { type: 'option', optionType: 'call', action: 'buy', strikeRelative: 'ITM_CALL', premiumFactor: 0.04, quantity: 1 },
            { type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'OTM_CALL', premiumFactor: 0.01, quantity: 1 }
        ],
        "Bear Call Spread": [
            { type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'ITM_CALL', premiumFactor: 0.04, quantity: 1 },
            { type: 'option', optionType: 'call', action: 'buy', strikeRelative: 'OTM_CALL', premiumFactor: 0.01, quantity: 1 }
        ],
        "Synthetic Long": [ // Long Call + Short Put + Long Future (to approximate initial cost)
            { type: 'option', optionType: 'call', action: 'buy', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'sell', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 },
            { type: 'future', action: 'buy', entryPriceRelative: 'ATM', quantity: 1 } // Entry price set to ATM
        ],
        "Covered Call": [ // Long Future + Short Call
            { type: 'future', action: 'buy', entryPriceRelative: 'ATM', quantity: 1 },
            { type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'OTM_CALL', premiumFactor: 0.02, quantity: 1 }
        ]
    };

    const STRIKE_OFFSET_FACTOR = 0.05; // 5% offset for OTM/ITM strikes

    // --- Helper Functions (moved to top for clarity) ---

    // Calculates P&L for a single leg at a given underlying price
    function calculateLegPayoff(leg, currentUnderlyingPrice, underlyingPriceForStrikes) {
        let legPayoff = 0;
        if (leg.type === 'option') {
            const strikePrice = getAbsoluteStrike(leg.strikeRelative, underlyingPriceForStrikes, STRIKE_OFFSET_FACTOR);
            const premium = getAbsolutePremium(leg.premiumFactor, underlyingPriceForStrikes); // Use the same underlying price for premium calculation

            if (leg.optionType === 'call') {
                if (leg.action === 'buy') {
                    legPayoff = Math.max(0, currentUnderlyingPrice - strikePrice) - premium;
                } else { // sell
                    legPayoff = Math.min(0, strikePrice - currentUnderlyingPrice) + premium;
                }
            } else { // put
                if (leg.action === 'buy') {
                    legPayoff = Math.max(0, strikePrice - currentUnderlyingPrice) - premium;
                } else { // sell
                    legPayoff = Math.min(0, currentUnderlyingPrice - strikePrice) + premium;
                }
            }
        } else { // future
            const entryPrice = getAbsoluteEntryPrice(leg.entryPriceRelative, underlyingPriceForStrikes);
            if (leg.action === 'buy') {
                legPayoff = (currentUnderlyingPrice - entryPrice);
            } else { // sell
                legPayoff = (entryPrice - currentUnderlyingPrice);
            }
        }
        return legPayoff * leg.quantity;
    }

    // Helper to calculate absolute strike for pre-built strategies
    function getAbsoluteStrike(strikeRelative, underlyingPrice, offsetFactor) {
        const offset = underlyingPrice * offsetFactor;
        switch (strikeRelative) {
            case 'ATM': return Math.round(underlyingPrice / 100) * 100; // Round to nearest 100 for BTC example
            case 'OTM_CALL': return Math.round((underlyingPrice + offset) / 100) * 100;
            case 'ITM_CALL': return Math.round((underlyingPrice - offset) / 100) * 100;
            case 'OTM_PUT': return Math.round((underlyingPrice - offset) / 100) * 100;
            case 'ITM_PUT': return Math.round((underlyingPrice + offset) / 100) * 100;
            default: return underlyingPrice;
        }
    }

    // Helper to calculate absolute premium for pre-built strategies
    function getAbsolutePremium(premiumFactor, underlyingPrice) {
        return Math.round(underlyingPrice * premiumFactor); // Simple calculation
    }

    // Helper to calculate absolute entry price for future legs in pre-built strategies
    function getAbsoluteEntryPrice(entryPriceRelative, underlyingPrice) {
        return Math.round(underlyingPrice / 100) * 100; // For ATM future, just current price
    }


    // --- Core Logic for Main Builder ---

    // Initial setup for the first leg (Leg 0)
    setupLegEventListeners(document.getElementById('leg_0'), 0);

    // Function to add a new strategy leg input block (Option or Future)
    function addStrategyLeg(initialData = null) {
        legCounter++;
        const legId = `leg_${legCounter}`;
        const newLegHtml = `
            <div class="option-leg" id="${legId}">
                <h3>Leg ${legCounter + 1} <button class="remove-leg">Remove</button></h3>
                <label>Leg Type:</label>
                <input type="radio" name="legType_${legCounter}" value="option" ${initialData?.type === 'option' ? 'checked' : ''}> Option
                <input type="radio" name="legType_${legCounter}" value="future" ${initialData?.type === 'future' ? 'checked' : ''}> Future
                <br>

                <div class="option-inputs">
                    <label>Option Type:</label>
                    <input type="radio" name="optionType_${legCounter}" value="call" ${initialData?.optionType === 'call' ? 'checked' : ''}> Call
                    <input type="radio" name="optionType_${legCounter}" value="put" ${initialData?.optionType === 'put' ? 'checked' : ''}> Put
                    <br>
                    <label for="strike-price_${legCounter}">Strike Price:</label>
                    <input type="number" id="strike-price_${legCounter}" value="${initialData?.strike || ''}" step="100">
                    <br>
                    <label for="premium_${legCounter}">Premium (per option):</label>
                    <input type="number" id="premium_${legCounter}" value="${initialData?.premium || ''}" step="1">
                </div>

                <div class="future-inputs" style="display: none;">
                    <label for="entry-price_${legCounter}">Entry Price:</label>
                    <input type="number" id="entry-price_${legCounter}" value="${initialData?.entryPrice || ''}" step="100">
                </div>

                <label>Action:</label>
                <input type="radio" name="action_${legCounter}" value="buy" ${initialData?.action === 'buy' ? 'checked' : ''}> Buy
                <input type="radio" name="action_${legType === 'option' ? 'option' : 'future'}_${legCounter}" value="sell" ${initialData?.action === 'sell' ? 'checked' : ''}> Sell
                <br>

                <label for="quantity_${legCounter}">Quantity:</label>
                <input type="number" id="quantity_${legCounter}" value="${initialData?.quantity || 1}" min="1" required>
                <hr>
            </div>
        `;
        strategyLegsDiv.insertAdjacentHTML('beforeend', newLegHtml);
        const newLegDiv = document.getElementById(legId);
        setupLegEventListeners(newLegDiv, legCounter);

        // Manually trigger change to set initial display state if initialData provided
        if (initialData) {
            newLegDiv.querySelector(`input[name="legType_${legCounter}"][value="${initialData.type}"]`).checked = true;
            newLegDiv.querySelector(`input[name="legType_${legCounter}"][value="${initialData.type}"]`).dispatchEvent(new Event('change'));
        }
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
                    legDiv.querySelector(`#strike-price_${index}`).required = true;
                    legDiv.querySelector(`#premium_${index}`).required = true;
                    legDiv.querySelector(`#entry-price_${index}`).required = false;
                } else { // future
                    optionInputs.style.display = 'none';
                    futureInputs.style.display = 'block';
                    legDiv.querySelector(`#strike-price_${index}`).required = false;
                    legDiv.querySelector(`#premium_${index}`).required = false;
                    legDiv.querySelector(`#entry-price_${index}`).required = true;
                }
            });
        });
        // Ensure initial state is correct for the first leg on load
        // This is important if you keep an initial leg in your HTML
        const initialLegTypeRadio = legDiv.querySelector(`input[name="legType_${index}"]:checked`);
        if (initialLegTypeRadio) {
            initialLegTypeRadio.dispatchEvent(new Event('change'));
        }
    }


    // Function to update leg numbers after removal
    function updateLegNumbers() {
        const legs = strategyLegsDiv.querySelectorAll('.option-leg');
        legs.forEach((leg, index) => {
            leg.id = `leg_${index}`;
            // Update the H3 title and remove button
            const h3 = leg.querySelector('h3');
            let removeButtonHtml = '';
            if (h3.querySelector('.remove-leg')) {
                removeButtonHtml = h3.querySelector('.remove-leg').outerHTML;
            }
            h3.innerHTML = `Leg ${index + 1} ${removeButtonHtml}`;

            // Update names/ids for all inputs within the leg
            leg.querySelector(`input[name^="legType"]`).name = `legType_${index}`;
            leg.querySelector(`input[name^="legType"][value="future"]`).name = `legType_${index}`;

            // Option inputs
            const optionTypeRadios = leg.querySelectorAll(`input[name^="optionType"]`);
            if (optionTypeRadios.length > 0) {
                optionTypeRadios[0].name = `optionType_${index}`;
                optionTypeRadios[1].name = `optionType_${index}`;
            }
            const strikePriceInput = leg.querySelector(`input[id^="strike-price"]`);
            if (strikePriceInput) strikePriceInput.id = `strike-price_${index}`;
            const premiumInput = leg.querySelector(`input[id^="premium"]`);
            if (premiumInput) premiumInput.id = `premium_${index}`;

            // Future inputs
            const entryPriceInput = leg.querySelector(`input[id^="entry-price"]`);
            if (entryPriceInput) entryPriceInput.id = `entry-price_${index}`;

            // Action radios
            const actionRadios = leg.querySelectorAll(`input[name^="action"]`);
            if (actionRadios.length > 0) {
                actionRadios[0].name = `action_${index}`;
                actionRadios[1].name = `action_${index}`;
            }

            const quantityInput = leg.querySelector(`input[id^="quantity"]`);
            if (quantityInput) quantityInput.id = `quantity_${index}`;

            // Re-attach event listeners for the updated leg
            setupLegEventListeners(leg, index);
        });
        legCounter = legs.length > 0 ? legs.length - 1 : -1; // Reset leg counter to correct value
    }

    // Function to clear all current legs from the builder
    function clearAllLegs() {
        strategyLegsDiv.innerHTML = ''; // Remove all leg divs
        legCounter = -1; // Reset counter so first new leg is leg_0
        // You might want to re-add the initial empty leg if you prefer that behavior
        // addStrategyLeg();
        // underlyingPriceInput.value = ''; // Clear underlying price if desired
        // Also clear chart and metrics
        if (chart) {
            chart.destroy();
        }
        maxProfitSpan.textContent = '-';
        maxLossSpan.textContent = '-';
        breakevenSpan.textContent = '-';
        riskRewardSpan.textContent = '-';
    }


    // --- Functions for Pre-built Strategies ---

    // Function to calculate payoff for a given set of legs and underlying price range
    function calculatePayoffForStrategy(legsConfig, minPrice, maxPrice, priceIncrement, underlyingPriceForStrikes) {
        const prices = [];
        const payoffs = [];
        for (let p = minPrice; p <= maxPrice; p += priceIncrement) {
            let totalPayoff = 0;
            legsConfig.forEach(leg => {
                totalPayoff += calculateLegPayoff(leg, p, underlyingPriceForStrikes);
            });
            prices.push(p);
            payoffs.push(totalPayoff);
        }
        return { prices, payoffs };
    }

    // Function to render mini-charts for pre-built strategies
    function renderPrebuiltStrategies() {
        const underlyingPriceInitial = parseFloat(underlyingPriceInput.value) || 30000; // Use current or default
        const priceRangeMin = underlyingPriceInitial * 0.9;
        const priceRangeMax = underlyingPriceInitial * 1.1;
        const priceIncrement = (priceRangeMax - priceRangeMin) / 50; // Fewer points for mini-chart

        for (const strategyName in PREBUILT_STRATEGIES) {
            const legsConfig = PREBUILT_STRATEGIES[strategyName];
            const { prices, payoffs } = calculatePayoffForStrategy(
                legsConfig, priceRangeMin, priceRangeMax, priceIncrement, underlyingPriceInitial
            );

            const listItem = document.createElement('li');
            listItem.dataset.strategy = strategyName; // Store strategy name
            listItem.innerHTML = `
                <h4>${strategyName}</h4>
                <div class="mini-chart-container">
                    <canvas id="miniChart-${strategyName.replace(/\s+/g, '-')}" width="150" height="70"></canvas>
                </div>
            `;
            strategyListElement.appendChild(listItem);

            // Initialize mini-chart
            const miniCtx = document.getElementById(`miniChart-${strategyName.replace(/\s+/g, '-')}`).getContext('2d');
            new Chart(miniCtx, {
                type: 'line',
                data: {
                    labels: prices.map(p => p.toFixed(0)),
                    datasets: [{
                        label: 'P&L',
                        data: payoffs,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: false,
                        segment: {
                            borderColor: ctx => {
                                const value = ctx.p1.parsed.y;
                                return value > 0 ? 'rgba(0, 128, 0, 1)' : 'rgba(255, 0, 0, 1)';
                            }
                        }
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { display: false }, // Hide x-axis
                        y: { display: false, beginAtZero: true } // Hide y-axis, ensure zero line
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    elements: {
                        line: { tension: 0.4 } // Smooth line
                    }
                }
            });

            // Add click listener to load strategy
            listItem.addEventListener('click', () => {
                loadPrebuiltStrategy(strategyName);
            });
        }
    }

    // Function to load a pre-built strategy into the main builder
    function loadPrebuiltStrategy(strategyName) {
        clearAllLegs(); // Start with a clean slate
        const underlyingPrice = parseFloat(underlyingPriceInput.value) || 30000; // Use current or default

        const strategyConfig = PREBUILT_STRATEGIES[strategyName];
        if (!strategyConfig) {
            console.error("Strategy not found:", strategyName);
            return;
        }

        strategyConfig.forEach(legConfig => {
            const newLegData = { ...legConfig }; // Clone the config
            // Translate relative strikes/premiums to absolute values for the input fields
            if (newLegData.type === 'option') {
                newLegData.strike = getAbsoluteStrike(newLegData.strikeRelative, underlyingPrice, STRIKE_OFFSET_FACTOR);
                newLegData.premium = getAbsolutePremium(newLegData.premiumFactor, underlyingPrice);
            } else if (newLegData.type === 'future') {
                newLegData.entryPrice = getAbsoluteEntryPrice(newLegData.entryPriceRelative, underlyingPrice);
            }
            addStrategyLeg(newLegData);
        });

        calculateButton.click(); // Trigger calculation for the newly loaded strategy
    }

    // --- Event Listeners for Main Builder Buttons ---
    addLegButton.addEventListener('click', () => addStrategyLeg());
    calculateButton.addEventListener('click', calculateCurrentStrategy);
    clearLegsButton.addEventListener('click', clearAllLegs); // Attach new button listener


    // --- Main Calculation Function (formerly anonymous function in event listener) ---
    function calculateCurrentStrategy() {
        const underlyingPrice = parseFloat(underlyingPriceInput.value);
        if (isNaN(underlyingPrice) || underlyingPrice <= 0) {
            alert("Please enter a valid positive underlying asset price.");
            return;
        }

        const legs = [];
        strategyLegsDiv.querySelectorAll('.option-leg').forEach((legDiv, index) => {
            const legType = legDiv.querySelector(`input[name="legType_${index}"]:checked`)?.value;
            const action = legDiv.querySelector(`input[name="action_${index}"]:checked`)?.value;
            const quantity = parseInt(legDiv.querySelector(`#quantity_${index}`).value);

            // Basic validation for core fields
            if (!legType || !action || isNaN(quantity) || quantity <= 0) {
                alert(`Please ensure Leg ${index + 1} has valid Leg Type, Action, and Quantity.`);
                return; // Stop processing if essential fields are missing
            }

            if (legType === 'option') {
                const optionType = legDiv.querySelector(`input[name="optionType_${index}"]:checked`)?.value;
                const strikePrice = parseFloat(legDiv.querySelector(`#strike-price_${index}`).value);
                const premium = parseFloat(legDiv.querySelector(`#premium_${index}`).value);

                if (!optionType || isNaN(strikePrice) || isNaN(premium) || strikePrice <= 0 || premium < 0) {
                    alert(`Please ensure Option Leg ${index + 1} has valid Option Type, Strike Price, and Premium.`);
                    return;
                }
                legs.push({ type: 'option', optionType, action, strike: strikePrice, premium: premium, quantity: quantity });
            } else { // future
                const entryPrice = parseFloat(legDiv.querySelector(`#entry-price_${index}`).value);
                if (isNaN(entryPrice) || entryPrice <= 0) {
                    alert(`Please ensure Entry Price for Future Leg ${index + 1} is a valid positive number.`);
                    return;
                }
                legs.push({ type: 'future', action: action, entryPrice: entryPrice, quantity: quantity });
            }
        });

        if (legs.length === 0) {
            alert("Please add at least one strategy leg.");
            return;
        }

        // Determine price range for the chart
        let minPriceForRange = underlyingPrice * 0.8;
        let maxPriceForRange = underlyingPrice * 1.2;

        const allStrikes = legs.filter(leg => leg.type === 'option').map(leg => leg.strike);
        if (allStrikes.length > 0) {
            const minStrike = Math.min(...allStrikes);
            const maxStrike = Math.max(...allStrikes);
            minPriceForRange = Math.min(minPriceForRange, minStrike * 0.9);
            maxPriceForRange = Math.max(maxPriceForRange, maxStrike * 1.1);
        }

        const priceIncrement = (maxPriceForRange - minPriceForRange) / 200;
        if (priceIncrement <= 0 || !isFinite(priceIncrement)) {
            console.warn("Price range is too small or invalid, adjusting increment. Defaulting to a wider range if necessary.");
            minPriceForRange = Math.max(0, underlyingPrice - 5000); // Default wider range for robustness
            maxPriceForRange = underlyingPrice + 5000;
            if (minPriceForRange >= maxPriceForRange) { // Ensure min < max
                 maxPriceForRange = minPriceForRange + 100; // Smallest possible range if error persists
            }
        }


        const prices = [];
        const payoffs = [];

        let currentMaxProfit = -Infinity;
        let currentMaxLoss = Infinity;
        const breakevens = new Set(); // Use a Set to store unique breakeven points

        for (let p = minPriceForRange; p <= maxPriceForRange; p += priceIncrement) {
            prices.push(p);
            let totalPayoff = 0;

            legs.forEach(leg => {
                let legPayoff = 0;
                if (leg.type === 'option') {
                    if (leg.optionType === 'call') {
                        if (leg.action === 'buy') {
                            legPayoff = Math.max(0, p - leg.strike) - leg.premium;
                        } else { // sell
                            legPayoff = Math.min(0, leg.strike - p) + leg.premium;
                        }
                    } else { // put
                        if (leg.action === 'buy') {
                            legPayoff = Math.max(0, leg.strike - p) - leg.premium;
                        } else { // sell
                            legPayoff = Math.min(0, p - leg.strike) + leg.premium;
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


        maxProfitSpan.textContent = currentMaxProfit === Infinity ? 'Unlimited' : currentMaxProfit === -Infinity ? 'Unlimited' : currentMaxProfit.toFixed(2);
        maxLossSpan.textContent = currentMaxLoss === -Infinity ? 'Unlimited' : currentMaxLoss === Infinity ? 'Unlimited' : currentMaxLoss.toFixed(2);
        breakevenSpan.textContent = breakevens.size > 0 ? Array.from(breakevens).join(', ') : 'None';

        let riskReward = 'N/A';
        if (currentMaxProfit === Infinity && currentMaxLoss === -Infinity) {
            riskReward = 'Unlimited Risk/Reward';
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
        } else if (currentMaxProfit === 0 && currentMaxLoss === 0) {
             riskReward = 'Flat';
        } else if (currentMaxProfit > 0 && currentMaxLoss > 0) {
            riskReward = 'All Profit (No Risk)';
        } else if (currentMaxProfit < 0 && currentMaxLoss < 0) {
            riskReward = 'All Loss (No Reward)';
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
                            maxTicksLimit: 20
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
    }

    // --- Initial setup calls ---
    renderPrebuiltStrategies(); // Render the pre-built strategies sidebar on load
});
