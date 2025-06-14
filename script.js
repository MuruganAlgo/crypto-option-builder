document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const navHomeButton = document.getElementById('nav-home');
    const navBuilderButton = document.getElementById('nav-builder');
    const navAdvancedStrategiesButton = document.getElementById('nav-advanced-strategies'); // New
    const homeSection = document.getElementById('home-section');
    const builderSection = document.getElementById('builder-section');
    const advancedStrategiesSection = document.getElementById('advanced-strategies-section'); // New

    const strategyLegsDiv = document.getElementById('strategy-legs');
    const addLegButton = document.getElementById('add-leg');
    const calculateButton = document.getElementById('calculate-strategy');
    const clearLegsButton = document.getElementById('clear-legs');
    const underlyingPriceInput = document.getElementById('underlying-price');
    const dteInput = document.getElementById('dte');
    const maxProfitSpan = document.getElementById('max-profit');
    const maxLossSpan = document.getElementById('max-loss');
    const breakevenSpan = document.getElementById('breakeven-points');
    const riskRewardSpan = document.getElementById('risk-reward');
    const ctx = document.getElementById('payoffChart').getContext('2d');
    const strategyListElement = document.getElementById('strategy-list');
    const advancedStrategyGrid = document.getElementById('advanced-strategy-grid'); // New

    const priceSlider = document.getElementById('price-slider');
    const sliderPriceDisplay = document.getElementById('slider-price-display');
    const sliderCurrentPLDisplay = document.getElementById('slider-current-pl');

    let chart;
    let legCounter = -1;
    let currentLegsData = []; // Store parsed leg data for slider calculations

    // --- Configuration Constants ---
    const STRIKE_OFFSET_FACTOR_SIMPLE = 0.05; // 5% offset for simple OTM/ITM strikes
    const STRIKE_INTERVAL_PERCENT = 0.02; // 2% of underlying price for spread widths
    const PREMIUM_PERCENT_ATM = 0.03; // Base premium for ATM options
    const PREMIUM_PERCENT_OTM_ITM = 0.01; // Base premium for OTM/ITM options (adjusted for spread pricing)
    const ASSUMED_IMPLIED_VOLATILITY = 1.0; // 100% annualized volatility for SD calculation

    // --- Pre-built Strategy Definitions ---
    // Note: For advanced strategies, strikeOffsetFactor is multiplied by (underlyingPrice * STRIKE_INTERVAL_PERCENT)
    // PremiumFactor is multiplied by (underlyingPrice * PREMIUM_PERCENT_OTM_ITM)
    const PREBUILT_STRATEGIES = {
        // Directional Strategies (sidebar)
        "Long Call": [{ type: 'option', optionType: 'call', action: 'buy', strikeRelative: 'ATM', premiumFactor: PREMIUM_PERCENT_ATM, quantity: 1 }],
        "Short Call": [{ type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'ATM', premiumFactor: PREMIUM_PERCENT_ATM, quantity: 1 }],
        "Long Put": [{ type: 'option', optionType: 'put', action: 'buy', strikeRelative: 'ATM', premiumFactor: PREMIUM_PERCENT_ATM, quantity: 1 }],
        "Short Put": [{ type: 'option', optionType: 'put', action: 'sell', strikeRelative: 'ATM', premiumFactor: PREMIUM_PERCENT_ATM, quantity: 1 }],
        "Bull Call Spread": [
            { type: 'option', optionType: 'call', action: 'buy', strikeRelative: 'ITM_CALL', premiumFactor: PREMIUM_PERCENT_ATM, quantity: 1 },
            { type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'OTM_CALL', premiumFactor: PREMIUM_PERCENT_OTM_ITM, quantity: 1 }
        ],
        "Bear Call Spread": [
            { type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'ITM_CALL', premiumFactor: PREMIUM_PERCENT_ATM, quantity: 1 },
            { type: 'option', optionType: 'call', action: 'buy', strikeRelative: 'OTM_CALL', premiumFactor: PREMIUM_PERCENT_OTM_ITM, quantity: 1 }
        ],
        "Bull Put Spread": [
            { type: 'option', optionType: 'put', action: 'sell', strikeRelative: 'ITM_PUT', premiumFactor: PREMIUM_PERCENT_ATM, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'buy', strikeRelative: 'OTM_PUT', premiumFactor: PREMIUM_PERCENT_OTM_ITM, quantity: 1 }
        ],
        "Bear Put Spread": [
            { type: 'option', optionType: 'put', action: 'buy', strikeRelative: 'ITM_PUT', premiumFactor: PREMIUM_PERCENT_ATM, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'sell', strikeRelative: 'OTM_PUT', premiumFactor: PREMIUM_PERCENT_OTM_ITM, quantity: 1 }
        ],
        "Covered Call": [
            { type: 'future', action: 'buy', entryPriceRelative: 'ATM', quantity: 1 },
            { type: 'option', optionType: 'call', action: 'sell', strikeRelative: 'OTM_CALL', premiumFactor: PREMIUM_PERCENT_OTM_ITM, quantity: 1 }
        ]
    };

    const ADVANCED_STRATEGIES = {
        // Non-Directional Strategies (new page)
        "Long Straddle": [
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 1 }, // ATM Call
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 1 }  // ATM Put
        ],
        "Short Straddle": [
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 1 }
        ],
        "Long Strangle": [
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 1, premiumFactor: 0.8, quantity: 1 }, // OTM Call
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: -1, premiumFactor: 0.8, quantity: 1 } // OTM Put
        ],
        "Short Strangle": [
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 1, premiumFactor: 0.8, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: -1, premiumFactor: 0.8, quantity: 1 }
        ],
        "Jade Lizard": [
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 2, premiumFactor: 0.5, quantity: 1 }, // Short OTM Call
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 3, premiumFactor: 0.2, quantity: 1 },  // Long Far OTM Call
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: -1, premiumFactor: 0.8, quantity: 1 } // Short OTM Put
        ],
        "Reverse Jade Lizard": [
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 2, premiumFactor: 0.5, quantity: 1 },
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 3, premiumFactor: 0.2, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: -1, premiumFactor: 0.8, quantity: 1 }
        ],
        "Call Ratio Spread (1:2)": [
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: -1, premiumFactor: 1.2, quantity: 1 }, // ITM Call
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 1, premiumFactor: 0.4, quantity: 2 }    // OTM Calls (2x quantity)
        ],
        "Put Ratio Spread (1:2)": [
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: 1, premiumFactor: 1.2, quantity: 1 }, // ITM Put
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: -1, premiumFactor: 0.4, quantity: 2 }    // OTM Puts (2x quantity)
        ],
        "Long Iron Fly": [
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: -2, premiumFactor: 0.2, quantity: 1 },  // Far OTM Put
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 1 },  // ATM Put
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 1 },  // ATM Call
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 2, premiumFactor: 0.2, quantity: 1 }    // Far OTM Call
        ],
        "Short Iron Fly": [
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: -2, premiumFactor: 0.2, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 1 },
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 1 },
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 2, premiumFactor: 0.2, quantity: 1 }
        ],
        "Long Iron Condor": [
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: -3, premiumFactor: 0.1, quantity: 1 }, // Far OTM Put (wing)
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: -1, premiumFactor: 0.5, quantity: 1 }, // Near OTM Put (body)
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 1, premiumFactor: 0.5, quantity: 1 },  // Near OTM Call (body)
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 3, premiumFactor: 0.1, quantity: 1 }    // Far OTM Call (wing)
        ],
        "Short Iron Condor": [
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: -3, premiumFactor: 0.1, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: -1, premiumFactor: 0.5, quantity: 1 },
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 1, premiumFactor: 0.5, quantity: 1 },
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 3, premiumFactor: 0.1, quantity: 1 }
        ],
        // Simplification for complex multi-leg/multi-DTE strategies:
        // For 'Double Fly' and 'Double Condor', these are often two shifted iron flies/condors.
        // Implementing them accurately requires careful strike selection and potentially 8 legs.
        // For simplicity, I will implement a "simplified" version that shows the general shape,
        // or note their complexity. Let's provide a simplified 6-leg double iron condor for now.
        // Batman is also very custom. I will use a very common interpretation of a long strangle
        // combined with a wider short strangle for volatility expansion.
        "Batman Strategy (Long Vol)": [ // Simplified: Long Strangle + Wider Short Strangle
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 1, premiumFactor: 0.8, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: -1, premiumFactor: 0.8, quantity: 1 },
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 3, premiumFactor: 0.4, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: -3, premiumFactor: 0.4, quantity: 1 }
        ],
        "Call Calendar (Same DTE Sim)": [ // Real calendar needs different DTE
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 1 }, // Long Term ATM
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 0, premiumFactor: 0.8, quantity: 1 } // Short Term ATM
        ],
        "Put Calendar (Same DTE Sim)": [ // Real calendar needs different DTE
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 1 },
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: 0, premiumFactor: 0.8, quantity: 1 }
        ],
        "Diagonal Calendar (Same DTE Sim)": [ // Real diagonal needs different DTE and strike
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: -1, premiumFactor: 1.0, quantity: 1 }, // ITM Call, Long DTE
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 1, premiumFactor: 0.8, quantity: 1 } // OTM Call, Short DTE
        ],
        "Call Butterfly": [
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: -2, premiumFactor: 0.5, quantity: 1 }, // ITM wing
            { type: 'option', optionType: 'call', action: 'sell', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 2 },  // ATM body (2x)
            { type: 'option', optionType: 'call', action: 'buy', strikeOffsetFactor: 2, premiumFactor: 0.5, quantity: 1 }    // OTM wing
        ],
        "Put Butterfly": [
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: 2, premiumFactor: 0.5, quantity: 1 },  // ITM wing
            { type: 'option', optionType: 'put', action: 'sell', strikeOffsetFactor: 0, premiumFactor: 1.0, quantity: 2 }, // ATM body (2x)
            { type: 'option', optionType: 'put', action: 'buy', strikeOffsetFactor: -2, premiumFactor: 0.5, quantity: 1 }  // OTM wing
        ]
        // Double Fly and Double Condor are significantly more complex (8+ legs, multiple centers)
        // and would clutter the UI/logic without very specific needs. Omitting for now.
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
    navAdvancedStrategiesButton.addEventListener('click', () => showSection('advanced-strategies-section')); // New listener

    // --- Helper Functions for Strategy Calculation ---
    function calculateLegPayoff(leg, currentUnderlyingPrice, underlyingPriceForStrikes) {
        let legPayoff = 0;
        if (leg.type === 'option') {
            // Use the already calculated absolute strike and premium from currentLegsData
            const strikePrice = leg.strike;
            const premium = leg.premium;

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
            const entryPrice = leg.entryPrice; // Use already calculated absolute entry price
            if (leg.action === 'buy') {
                legPayoff = (currentUnderlyingPrice - entryPrice);
            } else { // sell
                legPayoff = (entryPrice - currentUnderlyingPrice);
            }
        }
        return legPayoff * leg.quantity;
    }

    // This is now only used by old PREBUILT_STRATEGIES that use strikeRelative
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

    // This is now only used by old PREBUILT_STRATEGIES that use premiumFactor (single value)
    function getAbsolutePremium(premiumFactor, underlyingPrice) {
        return Math.round(underlyingPrice * premiumFactor);
    }
    
    // This is now only used by old PREBUILT_STRATEGIES that use entryPriceRelative
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
                <h3>Leg <span class="math-inline">\{legCounter \+ 1\} <button class\="remove\-leg"\>Remove</button\></h3\>
<label\>Leg Type\:</label\>
<input type\="radio" name\="legType\_</span>{legCounter}" value="option" <span class="math-inline">\{defaultType \=\=\= 'option' ? 'checked' \: ''\}\> Option
<input type\="radio" name\="legType\_</span>{legCounter}" value="future" <span class="math-inline">\{defaultType \=\=\= 'future' ? 'checked' \: ''\}\> Future
<br\>
<div class\="option\-inputs"\>
<label\>Option Type\:</label\>
<input type\="radio" name\="optionType\_</span>{legCounter}" value="call" <span class="math-inline">\{defaultOptionType \=\=\= 'call' ? 'checked' \: ''\}\> Call
<input type\="radio" name\="optionType\_</span>{legCounter}" value="put" <span class="math-inline">\{defaultOptionType \=\=\= 'put' ? 'checked' \: ''\}\> Put
<br\>
<label for\="strike\-price\_</span>{legCounter}">Strike Price:</label>
                    <input type="number" id="strike-price_${legCounter}" value="${initialData?.strike ?? ''}" step="100" <span class="math-inline">\{defaultType \=\=\= 'option' ? 'required' \: ''\}\>
<br\>
<label for\="premium\_</span>{legCounter}">Premium (per option):</label>
                    <input type="number" id="premium_${legCounter}" value="${initialData?.premium ?? ''}" step="1" <span class="math-inline">\{defaultType \=\=\= 'option' ? 'required' \: ''\}\>
</div\>
<div class\="future\-inputs" style\="display\: none;"\>
<label for\="entry\-price\_</span>{legCounter}">Entry Price:</label>
                    <input type="number" id="entry-price_${legCounter}" value="${initialData?.entryPrice ?? ''}" step="100" <span class="math-inline">\{defaultType \=\=\= 'future' ? 'required' \: ''\}\>
</div\>
<label\>Action\:</label\>
<input type\="radio" name\="action\_</span>{legCounter}" value="buy" <span class="math-inline">\{defaultAction \=\=\= 'buy' ? 'checked' \: ''\}\> Buy
<input type\="radio" name\="action\_</span>{legCounter}" value="sell" <span class="math-inline">\{defaultAction \=\=\= 'sell' ? 'checked' \: ''\}\> Sell
<br\>
<label for\="quantity\_</span>{legCounter}">Quantity:</label>
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
                const strikeInput = legDiv.querySelector(`#strike-price_${index}`);
                const premiumInput = legDiv.querySelector(`#premium_${index}`);
                const entryInput = legDiv.querySelector(`#entry-price_${index}`);


                if (selectedType === 'option') {
                    optionInputs.style.display = 'block';
                    futureInputs.style.display = 'none';
                    strikeInput.required = true;
                    premiumInput.required = true;
                    entryInput.required = false;
                    entryInput.value = '';
                } else { // future
                    optionInputs.style.display = 'none';
                    futureInputs.style.display = 'block';
                    strikeInput.required = false;
                    premiumInput.required = false;
                    strikeInput.value = '';
                    premiumInput.value = '';
                    entryInput.required = true;
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

    // --- Functions for Pre-built Strategies (Directional Sidebar) ---
    function calculatePayoffForStrategyPreview(legsConfig, minPrice, maxPrice, priceIncrement, underlyingPriceForStrikes) {
        const prices = [];
        const payoffs = [];
        const baseStrikeInterval = underlyingPriceForStrikes * STRIKE_INTERVAL_PERCENT; // Base for new strike system
        const basePremiumValue = underlyingPriceForStrikes * PREMIUM_PERCENT_OTM_ITM; // Base for new premium system

        const resolvedLegs = legsConfig.map(leg => {
            const resolvedLeg = { ...leg };
            if (leg.type === 'option') {
                if (typeof leg.strikeOffsetFactor !== 'undefined') {
                    resolvedLeg.strike = Math.round((underlyingPriceForStrikes + (baseStrikeInterval * leg.strikeOffsetFactor)) / 100) * 100;
                } else if (typeof leg.strikeRelative !== 'undefined') {
                    resolvedLeg.strike = getAbsoluteStrike(leg.strikeRelative, underlyingPriceForStrikes, STRIKE_OFFSET_FACTOR_SIMPLE);
                } else {
                    resolvedLeg.strike = Math.round(underlyingPriceForStrikes / 100) * 100; // Default ATM
                }
                if (typeof leg.premiumFactor !== 'undefined') {
                    resolvedLeg.premium = Math.round(basePremiumValue * leg.premiumFactor);
                } else {
                    resolvedLeg.premium = Math.round(underlyingPriceForStrikes * PREMIUM_PERCENT_ATM); // Default
                }
            } else if (leg.type === 'future') {
                resolvedLeg.entryPrice = Math.round(underlyingPriceForStrikes / 100) * 100; // Default ATM
            }
            return resolvedLeg;
        });


        for (let p = minPrice; p <= maxPrice; p += priceIncrement) {
            let totalPayoff = 0;
            resolvedLegs.forEach(leg => {
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
            const { prices, payoffs } = calculatePayoffForStrategyPreview(
                legsConfig, priceRangeMin, priceRangeMax, priceIncrement, underlyingPriceInitial
            );

            const listItem = document.createElement('li');
            listItem.dataset.strategy = strategyName;
            listItem.innerHTML = `
                <h4><span class="math-inline">\{strategyName\}</h4\>
<div class\="mini\-chart\-container"\>
<canvas id\="miniChart\-</span>{strategyName.replace(/\s+/g, '-')}" width="150" height="70"></canvas>
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
                        line
