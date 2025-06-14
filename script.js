document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const navHomeButton = document.getElementById('nav-home');
    const navBuilderButton = document.getElementById('nav-builder');
    const homeSection = document.getElementById('home-section');
    const builderSection = document.getElementById('builder-section');

    const strategyLegsDiv = document.getElementById('strategy-legs');
    const addLegButton = document.getElementById('add-leg');
    const calculateButton = document.getElementById('calculate-strategy');
    const clearLegsButton = document.getElementById('clear-legs');
    const underlyingPriceInput = document.getElementById('underlying-price');
    const dteInput = document.getElementById('dte'); // New DTE input
    const maxProfitSpan = document.getElementById('max-profit');
    const maxLossSpan = document.getElementById('max-loss');
    const breakevenSpan = document.getElementById('breakeven-points');
    const riskRewardSpan = document.getElementById('risk-reward');
    const ctx = document.getElementById('payoffChart').getContext('2d');
    const strategyListElement = document.getElementById('strategy-list');

    // New slider elements
    const priceSlider = document.getElementById('price-slider');
    const sliderPriceDisplay = document.getElementById('slider-price-display');
    const sliderCurrentPLDisplay = document.getElementById('slider-current-pl');

    let chart;
    let legCounter = -1; // Start at -1 so first added leg is leg_0
    let currentLegsData = []; // Store parsed leg data for slider calculations

    // --- Configuration Constants ---
    const STRIKE_OFFSET_FACTOR = 0.05; // 5% offset for OTM/ITM strikes
    const ASSUMED_IMPLIED_VOLATILITY = 1.0; // 100% annualized volatility for SD calculation

    // --- Pre-built Strategy Definitions (same as before) ---
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
            { type: 'option', optionType: 'buy', strikeRelative: 'OTM_CALL', premiumFactor: 0.01, quantity: 1 }
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

    // --- Section Navigation Logic ---
    function showSection(sectionId) {
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');

        const navButtons = document.querySelectorAll('.nav-button');
        navButtons.forEach(button => {
            button.classList.remove('active');
        });
        document.getElementById(`nav-${sectionId.replace('-section', '')}`).classList.add('active');
    }

    navHomeButton.addEventListener('click', () => showSection('home-section'));
    navBuilderButton.addEventListener('click', () => showSection('builder-section'));

    // --- Helper Functions for Strategy Calculation ---
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

    // Initial setup: Add one empty leg when builder section is first displayed
    addStrategyLeg();

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

        const selectedLegTypeRadio = newLegDiv.querySelector(`input[name="legType_${legCounter}"][value="${defaultType}"]`);
        if (selectedLegTypeRadio) {
            selectedLegTypeRadio.dispatchEvent(new Event('change'));
        }
    }

    function setupLegEventListeners(legDiv, index) {
        legDiv.querySelector('.remove-leg')?.addEventListener('click', (e) => {
            e.target.closest('.option-leg').remove();
            updateLegNumbers();
        });

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
                    legDiv.querySelector(`#entry-price_${index}`).value = ''; // Clear future input values
                } else { // future
                    optionInputs.style.display = 'none';
                    futureInputs.style.display = 'block';
                    legDiv.querySelector(`#strike-price_${index}`).required = false;
                    legDiv.querySelector(`#premium_${index}`).required = false;
                    legDiv.querySelector(`#strike-price_${index}`).value = ''; // Clear option values
                    legDiv.querySelector(`#premium_${index}`).value = '';
                    legDiv.querySelector(`#entry-price_${index}`).required = true;
                }
            });
        });

        const initialLegTypeRadio = legDiv.querySelector(`input[name="legType_${index}"]:checked`);
        if (initialLegTypeRadio) {
            initialLegTypeRadio.dispatchEvent(new Event('change'));
        }
    }

    function updateLegNumbers() {
        const legs = strategyLegsDiv.querySelectorAll('.option-leg');
        legs.forEach((leg, index) => {
            leg.id = `leg_${index}`;
            const h3 = leg.querySelector('h3');
            const removeBtn = leg.querySelector('.remove-leg');
            h3.textContent = `Leg ${index + 1} `;
            if (removeBtn) h3.appendChild(removeBtn);

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

            setupLegEventListeners(leg, index); // Re-attach event listeners
        });
        legCounter = legs.length > 0 ? legs.length - 1 : -1;
    }

    function clearAllLegs() {
        strategyLegsDiv.innerHTML = '';
        legCounter = -1;
        if (chart) {
            chart.destroy();
        }
        maxProfitSpan.textContent = '-';
        maxLossSpan.textContent = '-';
        breakevenSpan.textContent = '-';
        riskRewardSpan.textContent = '-';
        sliderPriceDisplay.textContent = '0';
        sliderCurrentPLDisplay.textContent = '-';
        addStrategyLeg(); // Always ensure at least one empty leg is present
    }

    // --- Functions for Pre-built Strategies ---
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
        clearAllLegs(); // Clear all existing legs and reset counter (this also adds one empty leg)
        const underlyingPrice = parseFloat(underlyingPriceInput.value) || 30000;

        const strategyConfig = PREBUILT_STRATEGIES[strategyName];
        if (!strategyConfig || strategyConfig.length === 0) {
            console.warn("Strategy not found or empty:", strategyName);
            return;
        }

        // Remove the single empty leg that clearAllLegs added,
        // because we are about to add specific pre-built legs.
        const firstEmptyLeg = document.getElementById('leg_0');
        if (firstEmptyLeg) {
            firstEmptyLeg.remove();
            legCounter = -1; // Reset counter for new additions
        }

        strategyConfig.forEach(legConfig => {
            const newLegData = { ...legConfig };
            if (newLegData.type === 'option') {
                newLegData.strike = getAbsoluteStrike(newLegData.strikeRelative, underlyingPrice, STRIKE_OFFSET_FACTOR);
                newLegData.premium = getAbsolutePremium(newLegData.premiumFactor, underlyingPrice);
            } else if (newLegData.type === 'future') {
                newLegData.entryPrice = getAbsoluteEntryPrice(newLegData.entryPriceRelative, underlyingPrice);
            }
            addStrategyLeg(newLegData);
        });

        setTimeout(() => {
            calculateButton.click();
        }, 150); // Increased delay slightly more for robust rendering
    }

    // --- Event Listeners for Main Builder Buttons ---
    addLegButton.addEventListener('click', () => addStrategyLeg());
    calculateButton.addEventListener('click', calculateCurrentStrategy);
    clearLegsButton.addEventListener('click', clearAllLegs);

    // --- Price Slider Event Listener ---
    priceSlider.addEventListener('input', () => {
        const sliderPrice = parseFloat(priceSlider.value);
        updateLivePriceMarker(sliderPrice);
    });

    // Function to calculate and update P&L for the live price marker
    function updateLivePriceMarker(price) {
        sliderPriceDisplay.textContent = price.toFixed(2);
        let totalPayoff = 0;
        currentLegsData.forEach(leg => {
            let legPayoff = 0;
            if (leg.type === 'option') {
                if (leg.optionType === 'call') {
                    if (leg.action === 'buy') {
                        legPayoff = Math.max(0, price - leg.strike) - leg.premium;
                    } else { // sell
                        legPayoff = Math.min(0, leg.strike - price) + leg.premium;
                    }
                } else { // put
                    if (leg.action === 'buy') {
                        legPayoff = Math.max(0, leg.strike - price) - leg.premium;
                    } else { // sell
                        legPayoff = Math.min(0, price - leg.strike) + leg.premium;
                    }
                }
            } else { // future
                if (leg.action === 'buy') {
                    legPayoff = (price - leg.entryPrice);
                } else { // sell
                    legPayoff = (leg.entryPrice - price);
                }
            }
            totalPayoff += legPayoff * leg.quantity;
        });
        sliderCurrentPLDisplay.textContent = totalPayoff.toFixed(2);

        // Update the Chart.js annotation for the live price marker
        if (chart && chart.options.plugins.annotation && chart.options.plugins.annotation.annotations.livePriceMarker) {
            chart.options.plugins.annotation.annotations.livePriceMarker.xMin = price;
            chart.options.plugins.annotation.annotations.livePriceMarker.xMax = price;
            chart.update(); // Update the chart to redraw the annotation
        }
    }


    // --- Main Calculation Function ---
    function calculateCurrentStrategy() {
        const underlyingPrice = parseFloat(underlyingPriceInput.value);
        const dte = parseFloat(dteInput.value);
        
        if (isNaN(underlyingPrice) || underlyingPrice <= 0) {
            alert("Please enter a valid positive underlying asset price.");
            return;
        }
        if (isNaN(dte) || dte <= 0) {
            alert("Please enter valid positive Days to Expiration (DTE).");
            return;
        }

        const legs = [];
        let hasValidationErrors = false;
        
        const allLegDivs = strategyLegsDiv.querySelectorAll('.option-leg');

        if (allLegDivs.length === 0) {
            alert("Please add at least one strategy leg.");
            return;
        }

        allLegDivs.forEach((legDiv, index) => {
            const legTypeInput = legDiv.querySelector(`input[name="legType_${index}"]:checked`);
            const actionInput = legDiv.querySelector(`input[name="action_${index}"]:checked`);
            const quantityInput = legDiv.querySelector(`#quantity_${index}`);

            const legType = legTypeInput ? legTypeInput.value : null;
            const action = actionInput ? actionInput.value : null;
            const quantity = parseInt(quantityInput ? quantityInput.value : '0');

            if (!legType || !action || isNaN(quantity) || quantity <= 0) {
                alert(`Error in Leg ${index + 1}: Please ensure Leg Type, Action, and Quantity are valid and filled.`);
                hasValidationErrors = true;
                return;
            }

            if (legType === 'option') {
                const optionTypeInput = legDiv.querySelector(`input[name="optionType_${index}"]:checked`);
                const strikePriceInput = legDiv.querySelector(`#strike-price_${index}`);
                const premiumInput = legDiv.querySelector(`#premium_${index}`);

                const optionType = optionTypeInput ? optionTypeInput.value : null;
                const strikePrice = parseFloat(strikePriceInput ? strikePriceInput.value : '0');
                const premium = parseFloat(premiumInput ? premiumInput.value : '0');

                if (!optionType || isNaN(strikePrice) || isNaN(premium) || strikePrice <= 0 || premium < 0) {
                    alert(`Error in Option Leg ${index + 1}: Please ensure Option Type, Strike Price, and Premium are valid and filled.`);
                    hasValidationErrors = true;
                    return;
                }
                legs.push({ type: 'option', optionType, action, strike: strikePrice, premium: premium, quantity: quantity });
            } else { // future
                const entryPriceInput = legDiv.querySelector(`#entry-price_${index}`);
                const entryPrice = parseFloat(entryPriceInput ? entryPriceInput.value : '0');
                if (isNaN(entryPrice) || entryPrice <= 0) {
                    alert(`Error in Future Leg ${index + 1}: Please ensure Entry Price is a valid positive number.`);
                    hasValidationErrors = true;
                    return;
                }
                legs.push({ type: 'future', action: action, entryPrice: entryPrice, quantity: quantity });
            }
        });

        if (hasValidationErrors) {
            return;
        }
        
        if (legs.length === 0) {
            alert("No valid strategy legs found to calculate. Please add/correct legs.");
            return;
        }

        // Store the parsed legs data globally for the slider to use
        currentLegsData = legs;

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

        if (minPriceForRange >= maxPriceForRange) {
             maxPriceForRange = minPriceForRange + (underlyingPrice * 0.2);
             if (maxPriceForRange <= minPriceForRange) maxPriceForRange = minPriceForRange + 1000;
        }
        if (minPriceForRange < 0) minPriceForRange = 0;

        // Ensure step is reasonable for the range to avoid too many labels
        const priceRange = maxPriceForRange - minPriceForRange;
        const priceIncrement = priceRange / 200; // Aim for 200 data points

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
            } else if (payoffs[i] === 0 && prices[i] !== 0) {
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


        // --- 1SD and 2SD Calculation and Annotations ---
        const expectedMove = underlyingPrice * ASSUMED_IMPLIED_VOLATILITY * Math.sqrt(dte / 365);
        const sdAnnotations = {
            // Current Futures Price Line (fixed based on input)
            currentPriceLine: {
                type: 'line',
                xMin: underlyingPrice, xMax: underlyingPrice,
                borderColor: 'rgba(0, 0, 255, 0.9)', // More prominent blue
                borderWidth: 3, // Thicker line
                borderDash: [6, 6], // Dotted line
                label: {
                    content: `Current Futures Price: ${underlyingPrice.toFixed(2)}`,
                    enabled: true,
                    position: 'end', // Position label at the end (top) of the line
                    backgroundColor: 'rgba(0, 0, 255, 0.9)',
                    color: 'white',
                    font: { size: 12 },
                    yAdjust: -10 // Adjust label vertically
                }
            },
            // -1 SD
            minus1SD: {
                type: 'line', xMin: underlyingPrice - expectedMove, xMax: underlyingPrice - expectedMove,
                borderColor: 'rgba(255, 99, 132, 0.7)', borderWidth: 2, borderDash: [6, 4],
                label: { content: '-1SD', enabled: true, position: 'end', backgroundColor: 'rgba(255, 99, 132, 0.7)', color: 'white', font: { size: 10 } }
            },
            // +1 SD
            plus1SD: {
                type: 'line', xMin: underlyingPrice + expectedMove, xMax: underlyingPrice + expectedMove,
                borderColor: 'rgba(255, 99, 132, 0.7)', borderWidth: 2, borderDash: [6, 4],
                label: { content: '+1SD', enabled: true, position: 'start', backgroundColor: 'rgba(255, 99, 132, 0.7)', color: 'white', font: { size: 10 } }
            },
            // -2 SD
            minus2SD: {
                type: 'line', xMin: underlyingPrice - (2 * expectedMove), xMax: underlyingPrice - (2 * expectedMove),
                borderColor: 'rgba(255, 159, 64, 0.7)', borderWidth: 2, borderDash: [8, 2],
                label: { content: '-2SD', enabled: true, position: 'end', backgroundColor: 'rgba(255, 159, 64, 0.7)', color: 'white', font: { size: 10 } }
            },
            // +2 SD
            plus2SD: {
                type: 'line', xMin: underlyingPrice + (2 * expectedMove), xMax: underlyingPrice + (2 * expectedMove),
                borderColor: 'rgba(255, 159, 64, 0.7)', borderWidth: 2, borderDash: [8, 2],
                label: { content: '+2SD', enabled: true, position: 'start', backgroundColor: 'rgba(255, 159, 64, 0.7)', color: 'white', font: { size: 10 } }
            },
            // Live Price Marker (will be updated by slider)
            livePriceMarker: {
                type: 'line',
                xMin: underlyingPrice, // Initial position same as current price
                xMax: underlyingPrice,
                borderColor: 'rgba(0, 128, 0, 1.0)', // Green for live marker
                borderWidth: 3,
                borderDash: [2, 2], // Denser dash for distinctness
                label: {
                    content: 'Live Price',
                    enabled: true,
                    position: 'end',
                    backgroundColor: 'rgba(0, 128, 0, 1.0)',
                    color: 'white',
                    font: { size: 12 },
                    yAdjust: -30 // Adjust label vertically, above the current price label
                }
            }
        };


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
                        type: 'linear', // Changed to linear scale for smooth slider interaction
                        title: {
                            display: true,
                            text: 'Underlying Asset Price at Expiration'
                        },
                        min: minPriceForRange, // Set explicit min/max
                        max: maxPriceForRange,
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(0); // Display price without decimals for clarity
                            },
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
                    },
                    annotation: { // Chart.js Annotation Plugin configuration
                        annotations: sdAnnotations
                    }
                }
            }
        });

        // --- Initialize Price Slider ---
        priceSlider.min = minPriceForRange.toFixed(0);
        priceSlider.max = maxPriceForRange.toFixed(0);
        priceSlider.step = (priceRange / 100).toFixed(0); // A step of roughly 1% of the range
        priceSlider.value = underlyingPrice.toFixed(0); // Set initial value
        updateLivePriceMarker(underlyingPrice); // Update display for initial position
    }

    // --- Initial setup calls ---
    renderPrebuiltStrategies(); // Render the pre-built strategies sidebar on load
    showSection('home-section'); // By default, show the home section on page load
});
