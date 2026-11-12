import React, { useState, useLayoutEffect, useRef } from 'react';
import { RecipeProvider, useRecipes } from './context/RecipeContext';
import { TimerProvider } from './context/TimerContext';
import { BottomDock } from './components/layout/BottomDock';
import { CoverShoppingList, useCoverScreen } from './components/shopping/CoverShoppingList';
import { UpdateNotice } from './components/layout/UpdateNotice';
import { WhatsNew } from './components/layout/WhatsNew';
import { BottomNav } from './components/layout/BottomNav';
import { DesktopNav } from './components/layout/DesktopNav';
import { PwaInstallPrompt } from './components/layout/PwaInstallPrompt';
import { RecipeList } from './components/recipes/RecipeList';
import { RecipeDetail } from './components/recipes/RecipeDetail';
import { MealPlanView } from './components/mealplan/MealPlanView';
import { ShoppingListView } from './components/shopping/ShoppingListView';
import { SettingsView } from './components/settings/SettingsView';
import { AddRecipeModal } from './components/recipes/AddRecipeModal';
import { AddShoppingItemModal } from './components/shopping/AddShoppingItemModal';
import { JoinRequestNotification } from './components/notifications/JoinRequestNotification';
import { OpenedRecipeSheet } from './components/share/OpenedRecipeSheet';
import { useModalBackHandler } from './hooks/useModalBackHandler';

const AppContent: React.FC = () => {
  // On the small outer screen of a folding phone only the shopping list is shown
  const isCover = useCoverScreen();
  const { activeTab, selectedRecipe, closeRecipeDetail, recipes } = useRecipes();
  // A minimized recipe stays open in the background, so ticked steps and portions are kept
  const [minimizedId, setMinimizedId] = useState<string | null>(null);
  const minimized = minimizedId ? recipes.find((r) => r.id === minimizedId) || null : null;
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showAddShoppingModal, setShowAddShoppingModal] = useState<boolean>(false);

  // Synchronize Modals with Android back button
  // Lägg till recept asks before input is lost. When it stays open on the phone's back button,
  // the back step is set up again (new id) so the next back press is caught too.
  const addCloseGuardRef = useRef<(() => boolean) | null>(null);
  const [addBackRound, setAddBackRound] = useState<number>(0);
  useModalBackHandler(
    showAddModal,
    () => {
      const staysOpen = addCloseGuardRef.current?.() ?? false;
      if (staysOpen) setAddBackRound((n) => n + 1);
      else setShowAddModal(false);
    },
    `add-recipe-modal-${addBackRound}`
  );
  useModalBackHandler(showAddShoppingModal, () => setShowAddShoppingModal(false), 'add-shopping-modal');
  useModalBackHandler(!!selectedRecipe, closeRecipeDetail, 'recipe-detail-modal');

  // Always reset scroll to top whenever changing tabs
  useLayoutEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTop = 0;
    };

    resetScroll();
    const rafId = requestAnimationFrame(resetScroll);
    const timerId = setTimeout(resetScroll, 20);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [activeTab]);

  if (isCover) return <CoverShoppingList />;

  return (
    <div className="min-h-screen w-full bg-[#FCFAF5] flex flex-col justify-between selection:bg-emerald-200 overflow-x-clip font-sans text-stone-900">
      {/* Desktop & iPad Top Navigation Bar (Hidden on Mobile) */}
      <DesktopNav
        onAddRecipeClick={() => setShowAddModal(true)}
        onAddShoppingItemClick={() => setShowAddShoppingModal(true)}
      />

      {/* Adaptive Container: max-w-md on mobile, max-w-5xl on tablet, max-w-7xl on desktop */}
      <main className="w-full max-w-md md:max-w-5xl lg:max-w-7xl mx-auto min-h-screen bg-[#FCFAF5] shadow-2xl md:shadow-none flex flex-col relative min-w-0 overflow-x-clip flex-1">
        {/* PWA Install Prompt Banner */}
        <PwaInstallPrompt />

        {/* Global Join Request Notification for Household Admin */}
        <JoinRequestNotification />

        {/* A recipe someone sent as a link */}
        <OpenedRecipeSheet />

        {/* Loads a newer version by itself when nothing would be lost, or tells about it */}
        <UpdateNotice busy={Boolean(selectedRecipe || minimized || showAddModal || showAddShoppingModal)} />

        {/* After an update: what is new */}
        <WhatsNew />

        {/* Main Tab Views (Stay mounted underneath when modal opens) */}
        {activeTab === 'recipes' && <RecipeList />}
        {activeTab === 'mealplan' && <MealPlanView />}
        {activeTab === 'shopping' && <ShoppingListView />}
        {activeTab === 'settings' && <SettingsView />}

        {/* Above the menu: a minimized recipe and the kitchen timer */}
        {!selectedRecipe && <BottomDock minimized={minimized} onCloseMinimized={() => setMinimizedId(null)} />}

        {/* The open recipe, and a minimized one kept in the background. The same key keeps the
            view (and what was ticked in it) when it is minimized and opened again. */}
        {[minimized, selectedRecipe && selectedRecipe.id !== minimized?.id ? selectedRecipe : null]
          .filter((r): r is NonNullable<typeof r> => Boolean(r))
          .map((r) => (
            <RecipeDetail
              key={r.id}
              recipe={selectedRecipe?.id === r.id ? selectedRecipe : r}
              hidden={selectedRecipe?.id !== r.id}
              onBack={() => {
                if (r.id === minimizedId) setMinimizedId(null);
                closeRecipeDetail();
              }}
              onMinimize={() => {
                setMinimizedId(r.id);
                closeRecipeDetail();
              }}
            />
          ))}

        {/* Global Add Recipe Modal */}
        {showAddModal && <AddRecipeModal onClose={() => setShowAddModal(false)} closeGuardRef={addCloseGuardRef} />}

        {/* Global Add Shopping Item Modal */}
        {showAddShoppingModal && (
          <AddShoppingItemModal onClose={() => setShowAddShoppingModal(false)} />
        )}

        {/* Persistent Bottom Navigation Bar with Center Add Button */}
        <BottomNav
          onAddRecipeClick={() => setShowAddModal(true)}
          onAddShoppingItemClick={() => setShowAddShoppingModal(true)}
        />
      </main>
    </div>
  );
};

export function App() {
  return (
    <RecipeProvider>
      <TimerProvider>
        <AppContent />
      </TimerProvider>
    </RecipeProvider>
  );
}

export default App;
