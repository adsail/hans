// Wegmans website DOM selectors
// Isolated here for easy updates if the site changes

export const SELECTORS = {
  // Login page
  login: {
    emailInput: 'input[name="email"], input[type="email"], #email',
    passwordInput: 'input[name="password"], input[type="password"], #password',
    submitButton: 'button[type="submit"], input[type="submit"]',
    signInLink: 'a[href*="sign-in"], a[href*="login"], button:has-text("Sign In")',
  },

  // Navigation
  nav: {
    accountMenu: '[data-testid="account-menu"], .account-menu, button:has-text("Account")',
    shopListsLink: 'a[href*="shopping-list"], a:has-text("Shopping Lists")',
    myListLink: 'a[href*="my-list"], a:has-text("My List")',
    myItemsLink: 'a[href*="my-items"], a:has-text("My Items"), a:has-text("Past Purchases")',
  },

  // Search
  search: {
    input: 'input[type="search"], input[placeholder*="Search"], #search-input, [data-testid="search-input"]',
    button: 'button[type="submit"], button:has-text("Search")',
    resultsContainer: '.search-results, [data-testid="search-results"]',
    productCard: '.product-card, [data-testid="product-card"], .product-tile, [data-testid="product-tile"]',
    productName: '.product-name, .product-title, h3, [data-testid="product-name"]',
    productPrice: '.product-price, .price, [data-testid="product-price"]',
    productSize: '.product-size, .size, [data-testid="product-size"]',
    addToListButton: 'button:has-text("Add to List"), button:has-text("Add to Shopping List"), [data-testid="add-to-list"]',
    noResults: '.no-results, :text("No results"), :text("couldn\'t find")',
  },

  // My Items / Past Purchases
  myItems: {
    container: '.my-items, [data-testid="my-items"], .past-purchases',
    searchInput: 'input[placeholder*="Search"], input[type="search"]',
    item: '.my-items-item, [data-testid="my-items-item"], .past-purchase-item, .product-card',
    itemName: '.item-name, .product-name, [data-testid="product-name"]',
    addToListButton: 'button:has-text("Add to List"), [data-testid="add-to-list"]',
  },

  // Shopping list page
  list: {
    container: '.shopping-list, [data-testid="shopping-list"], .my-list',
    item: '.list-item, [data-testid="list-item"], .shopping-list-item',
    itemName: '.item-name, .product-name, span',
    removeButton: 'button:has-text("Remove"), button[aria-label*="Remove"], .remove-btn, [data-testid="remove-item"]',
    emptyMessage: '.empty-list, :text("Your list is empty")',
    clearAllButton: 'button:has-text("Clear All"), button:has-text("Remove All")',
  },

  // Common
  common: {
    loadingSpinner: '.loading, .spinner, [data-testid="loading"]',
    modal: '.modal, [role="dialog"]',
    modalClose: '.modal-close, button[aria-label="Close"]',
    errorMessage: '.error, .alert-error, [role="alert"]',
  },
} as const;

// URLs
export const URLS = {
  base: 'https://www.wegmans.com',
  login: 'https://www.wegmans.com/sign-in/',
  shoppingList: 'https://www.wegmans.com/shopping-list/',
  myItems: 'https://www.wegmans.com/my-items/',
  pastPurchases: 'https://www.wegmans.com/past-purchases/',
  search: (query: string) => `https://www.wegmans.com/search/?q=${encodeURIComponent(query)}`,
} as const;
