function clickerApp() {
    return {
        tabsVisible: false, // Tabs initially hidden
        activeTab: 'Main',
        tabs: [
            { name: 'Main' },
            { name: 'Tech' },
        ],
        units: [
            {
                id: 1,
                userName: 'Unit 1',
                resourceAmount: 100,
                enabled: true,
                config: {
                    addPerClick: true,
                    btnLabel: 'Buy 1',
                    addPerSecond: 5
                },
                onClick() {
                    this.resourceAmount += 1;
                }
            },
            {
                id: 2,
                userName: 'Unit 2',
                resourceAmount: 50,
                enabled: true,
                config: {
                    addPerClick: false,
                    btnLabel: 'Buy 1',
                    addPerSecond: 10
                },
                onClick() {
                    this.resourceAmount += 2;
                }
            }
        ],
        setActiveTab(name) {
            this.activeTab = name;
        },
        showTabs() {
            this.tabsVisible = true; // Show tabs when the button is clicked
        }
    }
}