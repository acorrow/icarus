import { useState } from 'react'
import styles from './outfitting-category-browser.module.css'

const { OUTFITTING_CATEGORIES } = require('../../../../shared/outfitting-categories')

export default function OutfittingCategoryBrowser({ itemDatabase, selectedItem, onItemSelect }) {
  const [expandedCategories, setExpandedCategories] = useState(new Set())
  const [expandedSubcategories, setExpandedSubcategories] = useState(new Set())

  const toggleCategory = (categoryKey) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryKey)) {
        next.delete(categoryKey)
        // Collapse all subcategories when collapsing main category
        Object.keys(OUTFITTING_CATEGORIES[categoryKey]?.subcategories || {}).forEach(subKey => {
          const fullKey = `${categoryKey}.${subKey}`
          next.delete(fullKey)
        })
      } else {
        next.add(categoryKey)
      }
      return next
    })
  }

  const toggleSubcategory = (categoryKey, subcategoryKey) => {
    const fullKey = `${categoryKey}.${subcategoryKey}`
    setExpandedSubcategories(prev => {
      const next = new Set(prev)
      if (next.has(fullKey)) {
        next.delete(fullKey)
      } else {
        next.add(fullKey)
      }
      return next
    })
  }

  const handleItemClick = (item, categoryKey, subcategoryKey) => {
    onItemSelect({
      ...item,
      categoryKey,
      subcategoryKey,
      displayName: item.class && item.rating
        ? `${item.name} ${item.class}${item.rating}`
        : item.name
    })
  }

  return (
    <div className={styles.browser}>
      <div className={styles.browserHeader}>
        <h3 className={styles.browserTitle}>Select Item</h3>
        <p className={styles.browserDescription}>
          Choose an item to search for nearby stations
        </p>
      </div>
      <div className={styles.categoryList}>
        {Object.entries(OUTFITTING_CATEGORIES).map(([categoryKey, category]) => {
          const isExpanded = expandedCategories.has(categoryKey)

          return (
            <div key={categoryKey} className={styles.category}>
              <button
                className={styles.categoryHeader}
                onClick={() => toggleCategory(categoryKey)}
              >
                <span className={styles.categoryIcon}>{isExpanded ? '▼' : '▶'}</span>
                <span className={styles.categoryLabel}>{category.label}</span>
              </button>

              {isExpanded && (
                <div className={styles.subcategoryList}>
                  {Object.entries(category.subcategories || {}).map(([subcategoryKey, subcategory]) => {
                    const fullKey = `${categoryKey}.${subcategoryKey}`
                    const isSubExpanded = expandedSubcategories.has(fullKey)
                    const items = itemDatabase?.categories?.[categoryKey]?.[subcategoryKey] || []

                    return (
                      <div key={fullKey} className={styles.subcategory}>
                        <button
                          className={styles.subcategoryHeader}
                          onClick={() => toggleSubcategory(categoryKey, subcategoryKey)}
                        >
                          <span className={styles.subcategoryIcon}>{isSubExpanded ? '▼' : '▶'}</span>
                          <span className={styles.subcategoryLabel}>{subcategory.label}</span>
                          <span className={styles.itemCount}>({items.length})</span>
                        </button>

                        {isSubExpanded && items.length > 0 && (
                          <div className={styles.itemList}>
                            {items.map((item) => {
                              const itemKey = `${categoryKey}.${subcategoryKey}.${item.id}`
                              const isSelected = selectedItem?.id === item.id
                              const displayName = item.class && item.rating
                                ? `${item.name} ${item.class}${item.rating}`
                                : item.name

                              return (
                                <button
                                  key={itemKey}
                                  className={`${styles.itemButton} ${isSelected ? styles.itemButtonSelected : ''}`}
                                  onClick={() => handleItemClick(item, categoryKey, subcategoryKey)}
                                >
                                  <span className={styles.itemName}>{displayName}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
