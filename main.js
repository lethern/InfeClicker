let gUnits = [];
let gTechs = [];

let gPaused = false;

/*
1. zmieniamy klasy zeby rozdzielic logike od visual
 logike musimy miec w jednym miejscu, latwe do edycji, wszystkie tech i mnozniki itd.
2. okreslamy liste "nastepnych celi" (przy czym na samym poczatku moze byc ciezej, bo trzeba
 manualnie wpisac np. 20 lvl #1 i 20 lvl #2
 dalsze cele okreslamy jako np. "kupic tech1"
 cele mają też whitelist innych units ktore mozna kupowac w trakcie czekania
3. jesli aktualny cel nie mozemy zrobic, to algorytm oblicza co jest potrzebne (np. tech1 -> X animus)
 robimy petle, w ktorej kazdy krok to 1 sekunda
  - dodajemy zasoby za te sekunde
  - sprawdzamy czy mozemy kupic cel
  - sprawdzamy czy mozemy kupic inne rzeczy (uwaga: cel powinien miec liste rzeczy, ktore mozemy
	 kupowac. inaczej kupujac losowo, mozemy tracic zasoby ktore probujemy zbierać)
na kazdy cel zapisujemy czas uzyskania i zrzut memory (resources i units)
->
dodajemy nowe elementy
 -sacrifice (poswiecanie units zeby zwiekszyc ich wydajnosc)
 -noble felhog (ale nie robiony z animus, tylko)
 pozniej:
 -impy (resources)
 -jednostki (za resources)
 -expansje (uzywamy jednostek zeby rozszerzac itd.)
->
testujemy timingi:
odpalamy i zmieniamy, az timingi beda pasować
* */



class Resources{
	static resourceNames = {};

	constructor(){
		Alpine.store('resources', {
			storage: { animus: 0 },
			add(resource, mult = 1){
				for(let name in resource){
					let amount = resource[name] * mult;
					if(this.storage[name] === undefined){
						if(amount > 0){
							gFirstBuilt(name);
						}
						this.storage[name] = 0;
					}
					this.storage[name] += amount;
				}
			},
			canAfford(resource){
				let result = true;
				for(let name in resource){
					let amount = resource[name];
					if((this.storage[name] || 0) < amount) result = false;
				}
				return result;
			},
			sub(resource){
				for(let name in resource){
					let amount = resource[name];
					this.storage[name] -= amount;
				}
			},
			get(resourceName){
				return this.storage[resourceName] || 0;
			}
		})
	}

	add(resource, mult = 1){
		Alpine.store('resources').add(resource, mult);
	}
	canAfford(resource){
		return Alpine.store('resources').canAfford(resource);
	}
	sub(resource){
		Alpine.store('resources').sub(resource);
	}
	get(resourceName){
		return Alpine.store('resources').get(resourceName);
	}

	static printResource(resource, mult = 1){
		if(!resource) return '';
		let string = '';
		for(let name in resource){
			let amount = resource[name] * mult;
			if(string) string += ", ";
			let amountStr = amount.toFixed(0);
			if(amount < 1 && amount > 0) amountStr = Resources.printNumber(amount, 1);

			let name_output = Resources.resourceNames[name] || name;
			string += `${amountStr} ${name_output}`;
		}
		return string;
	}

	static fancyPrintResource(resource, mult, config = {}){
		if(!resource) return '';
		let string = '';
		for(let name in resource){
			let amount = resource[name] * mult;
			if(string) string += ", ";
			let amountStr = amount.toFixed(0);
			if(amount < 1 && amount > 0) amountStr = Resources.printNumber(amount, 1);

			let name_output = Resources.resourceNames[name] || name;
			if(amount > 0 && config.showPlus) string += '+';
			string += `${amountStr} ${name_output}`;
		}
		return string;
	}

	static printNumber(number, digits = 0){
		return number.toFixed(digits);
	}
}

function calculateCostResources(cost, level){
	let result = {};
	if(!cost) return result;
	for(let name in cost.resources){
		let amount = cost.resources[name];
		if(level && cost.multiplier) amount *= Math.pow(cost.multiplier, level);
		result[name] = Math.floor(amount);
	}
	return result;
}


function gProduce(){
	for(const unit of gUnits)
		unit.produce();
}

function gShowMessage(message){
	Alpine.store("messageHandler").showMessage(message);
}

let gLastTime = undefined;
let timeFormatter = new Intl.DateTimeFormat('pl-PL', {
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit'
})
function gFirstBuilt(unitName){
	let time = Date.now();
	let dt = 0;
	if(gLastTime){
		dt = time - gLastTime;
	}
	gLastTime = time;
	// eslint-disable-next-line no-console
	console.log("first " + unitName + " on " + (timeFormatter.format(time)) + ", "+ (dt/1000));
}


class ClickerUnitMechanic{
	constructor(parent){
		this.parent = parent;
		this.config = this.parent.config;
	}

	onClick() {
		let works = true;
		if(this.config.clickCost){
			let resources = calculateCostResources(this.config.clickCost, gResources.get(this.parent.resourceName));

			if(gResources.canAfford(resources)) {
				gResources.sub(resources)
			}else{
				works = false;
			}
		}
		if(works){
			if(this.config.addPerClick){
				gResources.add(this.config.addPerClick, 1)
			}
			if(this.config.clickCallback){
				this.config.clickCallback(this.parent);
			}
		}
	}

	produce(){
		if(!this.config.addPerSecond || !gResources.get(this.parent.resourceName)) return;
		gResources.add(this.config.addPerSecond, gResources.get(this.parent.resourceName))
	}
}

class ClickerUnit {
	constructor(config, visible = false){
		Resources.resourceNames[config.resourceName] = this.userName;

		Alpine.store('units')[config.resourceName] = Alpine.reactive({
			userName: config.userName,
			resourceName: config.resourceName,
			visible: visible,
			disabled: false,
			config: config,
			btnDisabled: false,
		});

		let store = Alpine.store('units')[config.resourceName];
		this.userName = store.userName;
		this.resourceName = store.resourceName;
		this.config = store.config;

		this.mechanic = new ClickerUnitMechanic(this);
	}

	get visible(){
		return Alpine.store('units')[this.resourceName].visible
	}
	set visible(value){
		if(Alpine.store('units')[this.resourceName].visible === value) return;

		Alpine.store('units')[this.resourceName].visible = value;

		if(value && this.config.unlockCondition && this.config.unlockCondition.message){
			gShowMessage(this.config.unlockCondition.message);
		}
	}
	get disabled(){
		return Alpine.store('units')[this.resourceName].disabled
	}
	set disabled(value){
		Alpine.store('units')[this.resourceName].disabled = value;
	}

	onClick() {
		this.mechanic.onClick();
	}

	produce(){
		if(this.disabled) return;
		this.mechanic.produce();
	}
}


document.addEventListener('alpine:init', () => {

	window.gResources = new Resources();

	(function tabs(){
		Alpine.store('tabs', {
			tabsVisible: false,
			activeTab: 'Main',
			tabs: {
				"Main": { enabled: true },
				"Tech": { enabled: false },
				"Test": { enabled: false },
			},
			setTabsVisible() {
				this.tabsVisible = true;
			},
			setActiveTab(tabName) {
				this.activeTab = tabName;
			},
			enableTab(tabName) {
				this.tabs[tabName].enabled = true;
			},
		});
		Alpine.data('tabs', () => ({
			tabs: Alpine.store('tabs').tabs
		}))
	})();

	Alpine.data('clickerUnits', () => ({
		units: [],
		init: function() {
			this.units = gUnits;
		}
	}))

	Alpine.data('clickerTechs', () => ({
		units: [],
		init: function() {
			this.units = gTechs;
		}
	}))

	// used as Alpine.store('units')[this.resourceName]
	Alpine.store('units', {});

	Alpine.store("messageHandler", {
		messages: [],
		showMessage(message) {
			this.messages.push({ text: message });
		},
		removeMessage(index) {
			this.messages.splice(index, 1);
		}
	});

	((function flags_and_messages() {
		Alpine.store('flags', {
			firstTimeTech: true,
		});

		Alpine.effect(() => {
			const activeTab = Alpine.store('tabs').activeTab;
			switch (activeTab) {
				case 'Tech':
					if (Alpine.store('flags').firstTimeTech) {
						Alpine.store('flags').firstTimeTech = false;
						gShowMessage("You enter FelHall, where smartest of Felhogs contemplate")
					}
					break;
			}
		});
	})());

	addGameUnits();

	window.alpineUnitInfo = function (unit) {
		return {
			passive: '',
			printPassive() {
				let amount = gResources.get(this.resourceName);
				this.passive = amount == 0 ? '' : Resources.fancyPrintResource(unit.config.addPerSecond, amount, {showPlus: true});

				if (unit.config.tech && unit.config.clickCost) {
					this.printTechHas();
				}
			},
			printTechHas(){
				let has = [];

				for(let name in unit.config.clickCost.resources){
					let name_output = Resources.resourceNames[name] || name;
					has.push(name_output+' '+ Resources.printNumber(gResources.get(name)));
				}
				this.passive = `Got: ${has.join(', ')}`;
			}
		}
	};
	window.alpineUnitLabel = function (unit) {
		return {
			label: '',
			update() {
				if(unit.customLabel)
					this.label = unit.customLabel;
				else if(unit.userName)
					this.label = unit.userName + ': ' + (Alpine.store('resources').storage[this.resourceName] || 0).toFixed(0);
			},
			init() {
				this.update();
				Alpine.effect(() => { this.update(); });
			}
		}
	};

	window.alpineClickerUnit = function (unit){
		return {
			resourceName: unit.resourceName,
			unit: null,
			clickCost: {},
			canAfford: false,
			btnDisabled: false,

			init() {
				this.unit = unit;
				this.calculateCost();
			},
			calculateCost() {
				if(this.unit.disabled) return;

				let resources = Alpine.store('resources').storage[this.resourceName];
				this.clickCost = calculateCostResources(this.unit.config.clickCost, resources);
			},
			checkConditions() {
				if(Alpine.store('units')[this.resourceName].btnDisabled && !this.btnDisabled){
					this.btnDisabled = true;
					this.canAfford = false;
					return;
				}
				if(this.unit.disabled) return;

				if (this.unit.config.clickCost) {
					this.canAfford = gResources.canAfford(this.clickCost);
				}
				if (!this.unit.visible) {
					if (this.unit.config.unlockCondition && this.unit.config.unlockCondition.resources
							&& gResources.canAfford(this.unit.config.unlockCondition.resources)) {
						this.unit.visible = true;
					}else{
						return;
					}
					if (this.canAfford) {
						this.unit.visible = true;
					}
				}
			},
			visible(){
				return !this.unit.disabled && this.unit.visible;
			}
		};
	};

	(function setup(){
		const params = new URLSearchParams(window.location.search);
		if (params.has('dev')) {
			Alpine.store('resources').add({shroud: 1000, shroudstone: 100, animus: 600});
		}

		setInterval(() => {
			if(!gPaused){
				gProduce();
			}
		}, 1000);
	})();

});


function addGameUnits() {
	gUnits.push(new ClickerUnit({
		userName: "Shroud",
		resourceName: "shroud",
		btnLabel: "Spread Shroud",
		addPerClick: {"shroud": 1}
	}, true));

	gUnits.push(new ClickerUnit({
		userName: "Shroudstone",
		resourceName: "shroudstone",
		addPerSecond: {"shroud": 1},
		clickCost: { resources: {"shroud": 10}, multiplier: 1.1 },
		addPerClick: {"shroudstone": 1},
		unlockCondition: { resources: { "shroud": 5 }}
	}));

	gUnits.push(new ClickerUnit({
		userName: "Meat Farm",
		resourceName: "meatfarm",
		clickCost: { resources: {"shroud": 20}, multiplier: 1.1 },
		addPerClick: {"meatfarm": 1},
		addPerSecond: {"felhog": 0.1},
		unlockCondition: { resources: { "shroud": 20 }, message: "Boss! Shroud is works! We seeing meat farm next hill!"}
	}));

	gUnits.push(new ClickerUnit({
		userName: "Felhog",
		resourceName: "felhog",
		addPerSecond: {"animus": 0.1},
		unlockCondition: { resources: { "felhog": 1 }}
	}));

	gUnits.push(new ClickerUnit({
		userName: "Animus",
		resourceName: "animus",
		//clickCost: { resources: {"felhog": 1} },
		//addPerClick: {"fiend": 1},
		unlockCondition: { resources: { "animus": 10 }, message: "This energy gives us lots of strong!"}
	}));

	gUnits.push(new ClickerUnit({
		userName: "",
		resourceName: "tech_unlock",
		btnLabel: "Build FelHall",
		clickCost: { resources: {"animus": 100} },
		clickCallback (unit) {
			Alpine.store('tabs').setTabsVisible();
			Alpine.store('tabs').enableTab('Tech');
			unit.disabled = true;
			gResources.add({"tech": 1}, 1)
		},
		//addPerClick: {"fiend": 1},
		unlockCondition: { resources: { "animus": 75 }}
	}));

	gUnits.push(new ClickerUnit({
		userName: "Noble Felhog",
		resourceName: "noblefelhog",
		clickCost: { resources: {"felhog": 10} },
		addPerClick: {"noblefelhog": 1},
		unlockCondition: { resources: { "tech": 2 }, message: "We be advanced now!"}
	}));


	gUnits.push(new ClickerUnit({
		userName: "Felhog Queen",
		resourceName: "felhogqueen",
		clickCost: { resources: {"noblefelhog": 20}, multiplier: 1.2 },
		addPerClick: {"felhogqueen": 1},
		addPerSecond: {"noblefelhog": 1},
		unlockCondition: { resources: { "tech": 2, "noblefelhog": 10 }}
	}));


	gTechs.push(new ClickerUnit({
		tech: true,
		userName: "Advance to Middle FelAges",//  (Animus: 100
		resourceName: "t_felages",
		clickCost: { resources: {"animus": 200}, multiplier: 1 },
		clickCallback (unit) {
			gResources.add(unit.resourceName, 1)
			Alpine.store('units')[unit.resourceName].btnDisabled = true;

			gResources.add({"tech": 1});
			document.body.classList.add("felages");
			unit.customLabel = "Middle FelAges: done";
		},
		unlockCondition: { resources: { "tech": 1 }}
	}))
}
