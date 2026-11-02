import type * as React from "react";
import type { IconName } from "./Icon";
/**
 * Шапка сайта: словесный знак, поиск на всю ширину, «Продать гир», иконки и вторая строка с направлениями и категориями.
 */
export interface HeaderProps { active?: 'catalog' | 'flea' | 'parts' | 'masters' | 'guide'; cart?: number; messages?: number }
export declare function Header(props: HeaderProps): JSX.Element;

declare global {
  interface Window {
    YaMusician: {
      Icon: typeof Icon; Wordmark: typeof Wordmark; Button: typeof Button; IconButton: typeof IconButton; FavoriteButton: typeof FavoriteButton;
      SearchBar: typeof SearchBar; FilterChip: typeof FilterChip; Field: typeof Field; Badge: typeof Badge; ConditionBadge: typeof ConditionBadge;
      PriceTag: typeof PriceTag; ListingCard: typeof ListingCard; PriceGuide: typeof PriceGuide; TrustStrip: typeof TrustStrip; Rating: typeof Rating;
      SellerCard: typeof SellerCard; Timeline: typeof Timeline; MasterCard: typeof MasterCard; RepairOrderCard: typeof RepairOrderCard;
      FitmentBadge: typeof FitmentBadge; PassportCard: typeof PassportCard; Alert: typeof Alert; Header: typeof Header;
      CatalogSwitch: typeof CatalogSwitch; ModelSummary: typeof ModelSummary; OfferList: typeof OfferList; AccessoryCard: typeof AccessoryCard; AccessoryRail: typeof AccessoryRail; ServicePicker: typeof ServicePicker;
      icons: IconName[]; formatRub: (value: number) => string;
    }
  }
}
