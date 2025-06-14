document.addEventListener('DOMContentLoaded', () => {
    const strategyLegsDiv = document.getElementById('strategy-legs');
    const addLegButton = document.getElementById('add-leg');
    const calculateButton = document.getElementById('calculate-strategy');
    const clearLegsButton = document.getElementById('clear-legs');
    const underlyingPriceInput = document.getElementById('underlying-price');
    const maxProfitSpan = document.getElementById('max-profit');
    const maxLossSpan = document.getElementById('max-loss');
    const breakevenSpan = document.getElementById('breakeven-points');
    const riskRewardSpan = document.getElementById('risk-reward');
    const ctx = document.getElementById('payoffChart').getContext('2d');
    const strategyListElement = document.getElementById('strategy-list');

    let chart;
    let legCounter = -1; // Start at -1 so first added leg is leg_0

    // --- Pre-built Strategy Definitions ---
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
        "Synthetic Long": [
            { type: 'option', optionType: 'call', action: 'buy', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'sell', strikeRelative: 'ATM', premiumFactor: 0.03, quantity: 1 },
            { type: 'future', action: 'buy', entryPriceRelative: 'ATM', quantity: 1 }
        ],
        "Covered Call": [
            { type: 'future', action: 'buy', entryPriceRelative: 'ATM', quantity: 1 },
            { type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'OTM_CALL', premiumFactor: 0.02, quantity: 1 }
        ]
    };

    const STRIKE_OFFSET_FACTOR = 0.05; // 5% offset for OTM/ITM strikes

    // --- Helper Functions ---
    function calculateLegPayoff(leg, currentUnderlyingPrice, underlyingPriceForStrikes) {
        let legPayoff = 0;
        if (leg.type === 'option') {
            const strikePrice = leg.strikeRelative ? getAbsoluteStrike(leg.strikeRelative, underlyingPriceForStrikes, STRIKE_OFFSET_FACTOR) : leg.strike;
            const premium = leg.premiumFactor ? getAbsolutePremium(leg.premiumFactor, underlyingPriceForStrikes) : leg.premium;

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
            const entryPrice = leg.entryPriceRelative ? getAbsoluteEntryPrice(leg.entryPriceRelative, underlyingPriceForStrikes) : leg.entryPrice;
            if (leg.action === 'buy') {
                legPayoff = (currentUnderlyingPrice - entryPrice);
            } else { // sell
                legPayoff = (entryPrice - currentUnderlyingPrice);
            }
        }
        return legPayoff * leg.quantity;
    }

    function getAbsoluteStrike(strikeRelative, underlyingPrice, offsetFactor) {
        const offset = underlyingPrice * offsetFactor;
        switch (strikeRelative) {
            case 'ATM': return Math.round(underlyingPrice / 100) * 100;
            case 'OTM_CALL': return Math.round((underlyingPrice + offset) / 100) * 100;
            case 'ITM_CALL': return Math.round((underlyingPrice - offset) / 100) * 100;
            case 'OTM_PUT': return Math.round((underlyingPrice - offset) / 100) * 100;
            case 'ITM_PUT': return Math.round((underlyingPrice + offset) / 100) * 100;
            default: return underlyingPrice;
        }
    }

    function getAbsolutePremium(premiumFactor, underlyingPrice) {
        return Math.round(underlyingPrice * premiumFactor);
    }

    function getAbsoluteEntryPrice(entryPriceRelative, underlyingPrice) {
        return Math.round(underlyingPrice / 100) * 100;
    }


    // --- Core Logic for Main Builder ---

    // Initial setup: Add one empty leg on load
    addStrategyLeg();

    // Function to add a new strategy leg input block (Option or Future)
    function addStrategyLeg(initialData = null) {
        legCounter++;
        const legId = `leg_${legCounter}`;
        const defaultType = initialData?.type || 'option';
        const defaultOptionType = initialData?.optionType || 'call';
        const defaultAction = initialData?.action || 'buy';

        const newLegHtml = `
            <div class="option-leg" id="${legId}">
                <h3>Leg ${legCounter + 1} <button class="remove-leg">Remove</button></h3>
                <label>Leg Type:</label>
                <input type="radio" name="legType_${legCounter}" value="option" ${defaultType === 'option' ? 'checked' : ''}> Option
                <input type="radio" name="legType_${legCounter}" value="future" ${defaultType === 'future' ? 'checked' : ''}> Future
                <br>

                <div class="option-inputs">
                    <label>Option Type:</label>
                    <input type="radio" name="optionType_${legCounter}" value="call" ${defaultOptionType === 'call' ? 'checked' : ''}> Call
                    <input type="radio" name="optionType_${legCounter}" value="put" ${defaultOptionType === 'put' ? 'checked' : ''}> Put
                    <br>
                    <label for="strike-price_${legCounter}">Strike Price:</label>
                    <input type="number" id="strike-price_${legCounter}" value="${initialData?.strike ?? ''}" step="100">
                    <br>
                    <label for="premium_${legCounter}">Premium (per option):</label>
                    <input type="number" id="premium_${legCounter}" value="${initialData?.premium ?? ''}" step="1">
                </div>

                <div class="future-inputs" style="display: none;">
                    <label for="entry-price_${legCounter}">Entry Price:</label>
                    <input type="number" id="entry-price_${legCounter}" value="${initialData?.entryPrice ?? ''}" step="100">
                </div>

                <label>Action:</label>
                <input type="radio" name="action_${legCounter}" value="buy" ${defaultAction === 'buy' ? 'checked' : ''}> Buy
                <input type="radio" name="action_${legCounter}" value="sell" ${defaultAction === 'sell' ? 'checked' : ''}> Sell
                <br>

                <label for="quantity_${legCounter}">Quantity:</label>
                <input type="number" id="quantity_${legCounter}" value="${initialData?.quantity ?? 1}" min="1" required>
                <hr>
            </div>
        `;
        strategyLegsDiv.insertAdjacentHTML('beforeend', newLegHtml);
        const newLegDiv = document.getElementById(legId);
        setupLegEventListeners(newLegDiv, legCounter);

        // Manually trigger change to set initial display state
        const selectedLegTypeRadio = newLegDiv.querySelector(`input[name="legType_${legCounter}"][value="${defaultType}"]`);
        if (selectedLegTypeRadio) {
            selectedLegTypeRadio.dispatchEvent(new Event('change'));
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
                    // legDiv.querySelector(`#entry-price_${index}`).required = false; // Not needed as it's hidden
                } else { // future
                    optionInputs.style.display = 'none';
                    futureInputs.style.display = 'block';
                    // legDiv.querySelector(`#strike-price_${index}`).required = false; // Not needed as it's hidden
                    // legDiv.querySelector(`#premium_${index}`).required = false; // Not needed as it's hidden
                    legDiv.querySelector(`#entry-price_${index}`).required = true;
                }
            });
        });
        // Ensure initial state is correct for the first leg on load or when added
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
            const h3 = leg.querySelector('h3');
            const removeBtn = leg.querySelector('.remove-leg');
            h3.textContent = `Leg ${index + 1} `; // Clear existing text content
            if (removeBtn) h3.appendChild(removeBtn); // Re-append button

            // Update names/ids for all inputs within the leg
            leg.querySelectorAll('[name^="legType_"]').forEach(el => el.name = `legType_${index}`);
            leg.querySelectorAll('[name^="optionType_"]').forEach(el => el.name = `optionType_${index}`);
            leg.querySelectorAll('[name^="action_"]').forEach(el => el.name = `action_${index}`);
            
            const strikeInput = leg.querySelector('[id^="strike-price_"]');
            if (strikeInput) strikeInput.id = `strike-price_${index}`;
            const premiumInput = leg.querySelector('[id^="premium_"]');
            if (premiumInput) premiumInput.id = `premium_${index}`;
            const entryInput = leg.querySelector('[id^="entry-price_"]');
            if (entryInput) entryInput.id = `entry-price_${index}`;
            const quantityInput = leg.querySelector('[id^="quantity_"]');
            if (quantityInput) quantityInput.id = `quantity_${index}`;

            // Re-attach event listeners for the updated leg
            setupLegEventListeners(leg, index);
        });
        legCounter = legs.length > 0 ? legs.length - 1 : -1;
    }

    function clearAllLegs() {
        strategyLegsDiv.innerHTML = '';
        legCounter = -1; // Reset counter so first new leg is leg_0
        addStrategyLeg(); // Add back one empty leg
        // Clear chart and metrics
        if (chart) {
            chart.destroy();
        }
        maxProfitSpan.textContent = '-';
        maxLossSpan.textContent = '-';
        breakevenSpan.textContent = '-';
        riskRewardSpan.textContent = '-';
    }


    // --- Functions for Pre-built Strategies ---

    function calculatePayoffForStrategy(legsConfig, minPrice, maxPrice, priceIncrement, underlyingPriceForStrikes) {
        const prices = [];
        const payoffs = [];
        for (let p = minPrice; p <= maxPrice; p += priceIncrement) {
            let totalPayoff = 0;
            legsConfig.forEach(leg => {
                // For mini-charts, we use the relative/factor values directly
                totalPayoff += calculateLegPayoff(leg, p, underlyingPriceForStrikes);
            });
            prices.push(p);
            payoffs.push(totalPayoff);
        }
        return { prices, payoffs };
    }

    function renderPrebuiltStrategies() {
        const underlyingPriceInitial = parseFloat(underlyingPriceInput.value) || 30000;
        const priceRangeMin = underlyingPriceInitial * 0.9;
        const priceRangeMax = underlyingPriceInitial * 1.1;
        const priceIncrement = (priceRangeMax - priceRangeMin) / 50;

        for (const strategyName in PREBUILT_STRATEGIES) {
            const legsConfig = PREBUILT_STRATEGIES[strategyName];
            const { prices, payoffs } = calculatePayoffForStrategy(
                legsConfig, priceRangeMin, priceRangeMax, priceIncrement, underlyingPriceInitial
            );

            const listItem = document.createElement('li');
            listItem.dataset.strategy = strategyName;
            listItem.innerHTML = `
                <h4>${strategyName}</h4>
                <div class="mini-chart-container">
                    <canvas id="miniChart-${strategyName.replace(/\s+/g, '-')}" width="150" height="70"></canvas>
                </div>
            `;
            strategyListElement.appendChild(listItem);

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
                        x: { display: false },
                        y: { display: false, beginAtZero: true }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    elements: {
                        line: { tension: 0.4 }
                    }
                }
            });

            listItem.addEventListener('click', () => {
                loadPrebuiltStrategy(strategyName);
            });
        }
    }

    function loadPrebuiltStrategy(strategyName) {
        clearAllLegs(); // Clear existing legs and add back one empty
        const underlyingPrice = parseFloat(underlyingPriceInput.value) || 30000;

        const strategyConfig = PREBUILT_STRATEGIES[strategyName];
        if (!strategyConfig) {
            console.error("Strategy not found:", strategyName);
            return;
        }

        // Remove the single empty leg added by clearAllLegs,
        // as we are now adding specific legs from the pre-built strategy.
        const initialLeg = document.getElementById('leg_0');
        if (initialLeg) {
            initialLeg.remove();
            legCounter = -1; // Reset counter so the next leg added is 0
        }


        strategyConfig.forEach(legConfig => {
            const newLegData = { ...legConfig };
            // Translate relative strikes/premiums to absolute values for the input fields
            if (newLegData.type === 'option') {
                newLegData.strike = getAbsoluteStrike(newLegData.strikeRelative, underlyingPrice, STRIKE_OFFSET_FACTOR);
                newLegData.premium = getAbsolutePremium(newLegData.premiumFactor, underlyingPrice);
            } else if (newLegData.type === 'future') {
                newLegData.entryPrice = getAbsoluteEntryPrice(newLegData.entryPriceRelative, underlyingPrice);
            }
            addStrategyLeg(newLegData); // Pass the calculated absolute values
        });

        // Trigger calculation after all legs are added and initialized
        // Use a small delay to ensure DOM updates are complete before reading values
        setTimeout(() => {
            calculateButton.click();
        }, 50);
    }

    // --- Event Listeners for Main Builder Buttons ---
    addLegButton.addEventListener('click', () => addStrategyLeg());
    calculateButton.addEventListener('click', calculateCurrentStrategy);
    clearLegsButton.addEventListener('click', clearAllLegs);


    // --- Main Calculation Function ---
    function calculateCurrentStrategy() {
        const underlyingPrice = parseFloat(underlyingPriceInput.value);
        if (isNaN(underlyingPrice) || underlyingPrice <= 0) {
            alert("Please enter a valid positive underlying asset price.");
            return;
        }

        const legs = [];
        let isValid = true; // Flag to track overall validity
        strategyLegsDiv.querySelectorAll('.option-leg').forEach((legDiv, index) => {
            const legTypeInput = legDiv.querySelector(`input[name="legType_${index}"]:checked`);
            const actionInput = legDiv.querySelector(`input[name="action_${index}"]:checked`);
            const quantityInput = legDiv.querySelector(`#quantity_${index}`);

            const legType = legTypeInput ? legTypeInput.value : null;
            const action = actionInput ? actionInput.value : null;
            const quantity = parseInt(quantityInput ? quantityInput.value : '0');

            if (!legType || !action || isNaN(quantity) || quantity <= 0) {
                alert(`Please ensure Leg ${index + 1} has valid Leg Type, Action, and Quantity. All fields must be filled.`);
                isValid = false;
                return; // Stop processing this leg, but continue checking others for alerts
            }

            if (legType === 'option') {
                const optionTypeInput = legDiv.querySelector(`input[name="optionType_${index}"]:checked`);
                const strikePriceInput = legDiv.querySelector(`#strike-price_${index}`);
                const premiumInput = legDiv.querySelector(`#premium_${index}`);

                const optionType = optionTypeInput ? optionTypeInput.value : null;
                const strikePrice = parseFloat(strikePriceInput ? strikePriceInput.value : '0');
                const premium = parseFloat(premiumInput ? premiumInput.value : '0');

                if (!optionType || isNaN(strikePrice) || isNaN(premium) || strikePrice <= 0 || premium < 0) {
                    alert(`Please ensure Option Leg ${index + 1} has valid Option Type, Strike Price, and Premium. All fields must be filled.`);
                    isValid = false;
                    return;
                }
                legs.push({ type: 'option', optionType, action, strike: strikePrice, premium: premium, quantity: quantity });
            } else { // future
                const entryPriceInput = legDiv.querySelector(`#entry-price_${index}`);
                const entryPrice = parseFloat(entryPriceInput ? entryPriceInput.value : '0');
                if (isNaN(entryPrice) || entryPrice <= 0) {
                    alert(`Please ensure Entry Price for Future Leg ${index + 1} is a valid positive number.`);
                    isValid = false;
                    return;
                }
                legs.push({ type: 'future', action: action, entryPrice: entryPrice, quantity: quantity });
            }
        });

        if (!isValid || legs.length === 0) {
            if (legs.length === 0 && isValid) { // Only show this if no other validation errors
                alert("Please add at least one strategy leg.");
            }
            return; // Exit if any validation failed
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

        // Ensure a valid range if initial calculation is off
        if (minPriceForRange >= maxPriceForRange) {
             maxPriceForRange = minPriceForRange + (underlyingPrice * 0.2); // Add 20% of underlying price
             if (maxPriceForRange <= minPriceForRange) maxPriceForRange = minPriceForRange + 1000; // Fallback
        }
        if (minPriceForRange < 0) minPriceForRange = 0; // Price cannot be negative

        const priceIncrement = (maxPriceForRange - minPriceForRange) / 200;
        if (priceIncrement <= 0 || !isFinite(priceIncrement)) {
            console.error("Calculated price increment is invalid. Check price range logic.");
            alert("Could not calculate strategy payoff. Please check input values or add more legs.");
            return;
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
                // For main chart, use values directly from input fields
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

        // Find break-even points
        for (let i = 0; i < payoffs.length - 1; i++) {
            if (payoffs[i] * payoffs[i + 1] < 0) {
                const x1 = prices[i];
                const y1 = payoffs[i];
                const x2 = prices[i + 1];
                const y2 = payoffs[i + 1];
                const interpolatedBreakeven = x1 - y1 * (x2 - x1) / (y2 - y1);
                breakevens.add(interpolatedBreakeven.toFixed(2));
            } else if (payoffs[i] === 0 && prices[i] !== 0) { // Check if exactly zero and not just starting at 0
                breakevens.add(prices[i].toFixed(2));
            }
        }


        maxProfitSpan.textContent = currentMaxProfit === Infinity ? 'Unlimited' : (currentMaxProfit === -Infinity ? 'Unlimited' : currentMaxProfit.toFixed(2));
        maxLossSpan.textContent = currentMaxLoss === -Infinity ? 'Unlimited' : (currentMaxLoss === Infinity ? 'Unlimited' : currentMaxLoss.toFixed(2));
        breakevenSpan.textContent = breakevens.size > 0 ? Array.from(breakevens).join(', ') : 'None';

        let riskReward = 'N/A';
        if (currentMaxProfit === Infinity && currentMaxLoss === -Infinity) {
            riskReward = 'Unlimited Risk/Reward';
        } else if (currentMaxProfit === Infinity) {
            riskReward = 'Unlimited Reward';
        } else if (currentMaxLoss === -Infinity) {
            riskReward = 'Unlimited Risk';
        } else if (currentMaxProfit >= 0 && currentMaxLoss <= 0) {
            if (currentMaxProfit > 0 && currentMaxLoss < 0) {
                riskReward = (currentMaxProfit / Math.abs(currentMaxLoss)).toFixed(2);
            } else if (currentMaxProfit > 0 && currentMaxLoss === 0) {
                riskReward = 'Unlimited Reward (Limited Risk)';
            } else if (currentMaxProfit === 0 && currentMaxLoss < 0) {
                riskReward = '0 (Limited Reward, Limited Risk)';
            } else { // currentMaxProfit === 0 && currentMaxLoss === 0
                riskReward = 'Flat';
            }
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
                labels: prices.map(p => p.toFixed(0)),
                datasets: [{
                    label: 'Strategy P&L at Expiration',
                    data: payoffs,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    pointRadius: 0,
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
                        type: 'category',
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
    // The initial call to addStrategyLeg() already adds the first leg.
    // If you want to start with a completely empty builder, then:
    // clearAllLegs(); // Call this instead of addStrategyLeg() above, it will add one empty leg.
});
