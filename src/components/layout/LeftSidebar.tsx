import { SearchBar } from "@/components/SearchBar";
import { TabButton } from "@/components/TabButton";
import { SearchResults } from "@/components/SearchResults";
import { SearchTrack } from "@/types/wejay";
import { Heart, Search } from "lucide-react";

type Tab = "search" | "favorites";

interface LeftSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  searchResults: SearchTrack[];
  isLoading: boolean;
  error: string | null;
  favorites: SearchTrack[];
  isLoadingFavorites: boolean;
  favoritesError: string | null;
  addedTrackIds: Set<string>;
  onAddTrack: (track: SearchTrack) => void;
}

export function LeftSidebar({
  activeTab,
  onTabChange,
  searchQuery,
  onSearch,
  searchResults,
  isLoading,
  error,
  favorites,
  isLoadingFavorites,
  favoritesError,
  addedTrackIds,
  onAddTrack,
}: LeftSidebarProps) {
  return (
    <div className="space-y-6 lg:order-1 order-2">
      <SearchBar onSearch={onSearch} />

      <div className="flex gap-3">
        <TabButton active={activeTab === "search"} onClick={() => onTabChange("search")}>
          <span className="flex items-center gap-2 uppercase">
            <Search className="w-4 h-4" />
            SEARCH
          </span>
        </TabButton>
        <TabButton active={activeTab === "favorites"} onClick={() => onTabChange("favorites")}>
          <span className="flex items-center gap-2 uppercase">
            <Heart className="w-4 h-4" />
            FAVORITES
          </span>
        </TabButton>
      </div>

      <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
        <SearchResults
          activeTab={activeTab}
          isLoading={isLoading}
          error={error}
          searchQuery={searchQuery}
          searchResults={searchResults}
          favorites={favorites}
          isLoadingFavorites={isLoadingFavorites}
          favoritesError={favoritesError}
          addedTrackIds={addedTrackIds}
          onAddTrack={onAddTrack}
        />
      </div>
    </div>
  );
}
