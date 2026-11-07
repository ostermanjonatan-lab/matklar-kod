import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { useEffect } from 'react';
import type { Recipe, MealPlanDay, ShoppingItem, UserProfile, Household, PantryItem, HouseholdJoinRequest, PendingJoinState } from '../types/recipe';
import { normalizeMealPlan, sanitizeRecipe } from './recipeData';
import { HOUSEHOLDS_STORAGE_KEY, ACTIVE_HOUSEHOLD_ID_KEY } from './storageKeys';
import { subscribeToLocalChanges, subscribeToSupabaseRealtime, syncAisleOverridesWithSupabase, subscribeToAisleOverrides, mapRowToShoppingItem, fetchHouseholdDataFromSupabase, mapRowToRecipe, fetchJoinRequestsFromSupabase, checkJoinRequestStatusInSupabase, subscribeToJoinRequestApproval } from '../services/realtimeSync';
import { mergeIngredientsIntoShoppingList, getAisleOverride } from '../utils/shoppingAggregator';

export interface HouseholdSyncDeps {
  households: Household[];
  setHouseholds: Dispatch<SetStateAction<Household[]>>;
  setActiveHouseholdId: Dispatch<SetStateAction<string | null>>;
  currentUser: UserProfile;
  setCurrentUser: Dispatch<SetStateAction<UserProfile>>;
  recipes: Recipe[];
  setRecipes: Dispatch<SetStateAction<Recipe[]>>;
  mealPlan: MealPlanDay[];
  setMealPlan: Dispatch<SetStateAction<MealPlanDay[]>>;
  setShoppingList: Dispatch<SetStateAction<ShoppingItem[]>>;
  setPantryItems: Dispatch<SetStateAction<PantryItem[]>>;
  selectedRecipe: Recipe | null;
  setSelectedRecipe: Dispatch<SetStateAction<Recipe | null>>;
  setLastSyncTimestamp: Dispatch<SetStateAction<number>>;
  setJoinRequests: Dispatch<SetStateAction<HouseholdJoinRequest[]>>;
  pendingJoin: PendingJoinState | null;
  setPendingJoin: Dispatch<SetStateAction<PendingJoinState | null>>;
  isLiveSupabase: boolean;
  currentUserRef: MutableRefObject<UserProfile>;
  isHouseholdAdmin: boolean;
  pendingJoinRef: MutableRefObject<PendingJoinState | null>;
  pendingShoppingCheckedTimeoutsRef: MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>;
  recentLocalShoppingUpdatesRef: MutableRefObject<Map<string, number>>;
  household: Household | null;
  /** Set when the first fetch of the household's data from Supabase is done. */
  setHouseholdLoaded: Dispatch<SetStateAction<boolean>>;
}

/**
 * Keeps the household's data in step between phones and browser tabs: the realtime
 * subscription to Supabase and other tabs, join requests for the admin, the household's
 * shared aisle choices, and the answer to this phone's own join request.
 * It runs inside RecipeProvider and works on its state, which is passed in.
 */
export function useHouseholdSync(deps: HouseholdSyncDeps): void {
  const {
    households,
    setHouseholds,
    setActiveHouseholdId,
    currentUser,
    setCurrentUser,
    recipes,
    setRecipes,
    
    setMealPlan,
    setShoppingList,
    setPantryItems,
    selectedRecipe,
    setSelectedRecipe,
    setLastSyncTimestamp,
    setJoinRequests,
    pendingJoin,
    setPendingJoin,
    isLiveSupabase,
    currentUserRef,
    isHouseholdAdmin,
    pendingJoinRef,
    pendingShoppingCheckedTimeoutsRef,
    recentLocalShoppingUpdatesRef,
    household,
    setHouseholdLoaded,
  } = deps;

  // Realtime Sync Subscription
  useEffect(() => {
    const unsubscribeLocal = subscribeToLocalChanges((msg) => {
      setLastSyncTimestamp(Date.now());
      if (msg.type === 'RECIPE_UPDATE') {
        const cleanPayload = sanitizeRecipe(msg.payload);
        setRecipes((prev) => {
          const exists = prev.some((r) => r.id === cleanPayload.id);
          if (exists) {
            return prev.map((r) => (r.id === cleanPayload.id ? cleanPayload : r));
          }
          return [cleanPayload, ...prev];
        });
        if (selectedRecipe?.id === cleanPayload.id) {
          setSelectedRecipe(cleanPayload);
        }
      } else if (msg.type === 'RECIPE_DELETE') {
        setRecipes((prev) => prev.filter((r) => r.id !== msg.payload.id));
      } else if (msg.type === 'RECIPES_SYNC') {
        const cleanList = msg.payload.map(sanitizeRecipe);
        setRecipes(cleanList);
        setMealPlan((prev) => normalizeMealPlan(prev, cleanList));
      } else if (msg.type === 'MEALPLAN_UPDATE') {
        setMealPlan((prev) => normalizeMealPlan(msg.payload || prev, recipes));
      } else if (msg.type === 'SHOPPING_UPDATE') {
        setShoppingList(msg.payload);
      } else if (msg.type === 'PANTRY_UPDATE') {
        setPantryItems(msg.payload);
      } else if (msg.type === 'HOUSEHOLD_UPDATE') {
        const curr = currentUserRef.current;
        const isCreator = Boolean(msg.payload.creatorId && curr.id === msg.payload.creatorId);
        const isStillMember = msg.payload.members?.some(
          (m) =>
            m.id === curr.id ||
            (curr.displayName && m.displayName.trim().toLowerCase() === curr.displayName.trim().toLowerCase())
        );

        if (msg.payload.members && !isStillMember && !isCreator && household?.id === msg.payload.id) {
          // Current user was removed from this household
          setHouseholds((prev) => prev.filter((h) => h.id !== msg.payload.id));
          setActiveHouseholdId((prev) => (prev === msg.payload.id ? null : prev));
          try {
            const updated = households.filter((h) => h.id !== msg.payload.id);
            localStorage.setItem(HOUSEHOLDS_STORAGE_KEY, JSON.stringify(updated));
            localStorage.removeItem(ACTIVE_HOUSEHOLD_ID_KEY);
          } catch {}
          setRecipes([]);
          setMealPlan(normalizeMealPlan([]));
          setShoppingList([]);
          return;
        }

        setHouseholds((prev) =>
          prev.map((h) =>
            h.id === msg.payload.id
              ? {
                  ...h,
                  name: msg.payload.name,
                  joinCode: msg.payload.joinCode,
                  creatorId: msg.payload.creatorId !== undefined ? msg.payload.creatorId : h.creatorId,
                  members: msg.payload.members && msg.payload.members.length > 0 ? msg.payload.members : h.members,
                }
              : h
          )
        );
      } else if (msg.type === 'JOIN_REQUEST') {
        if (household?.id === msg.payload.householdId) {
          setJoinRequests((prev) => {
            if (prev.some((r) => r.id === msg.payload.id)) return prev;
            return [...prev, msg.payload];
          });
        }
      } else if (msg.type === 'JOIN_REQUEST_APPROVED') {
        setJoinRequests((prev) => prev.filter((r) => r.id !== msg.payload.requestId));
        if (pendingJoinRef.current && pendingJoinRef.current.requestId === msg.payload.requestId) {
          setActiveHouseholdId(msg.payload.householdId);
          if (msg.payload.user) {
            setCurrentUser(msg.payload.user);
          } else {
            setCurrentUser({
              id: msg.payload.userId,
              displayName: msg.payload.displayName,
              initials: (msg.payload.displayName || 'M').charAt(0).toUpperCase(),
              roleTitle: 'Medlem',
              isAdmin: false,
            });
          }
          setPendingJoin(null);
        }
      } else if (msg.type === 'JOIN_REQUEST_REJECTED') {
        setJoinRequests((prev) => prev.filter((r) => r.id !== msg.payload.requestId));
        if (pendingJoinRef.current && pendingJoinRef.current.requestId === msg.payload.requestId) {
          setPendingJoin((prev) => (prev ? { ...prev, status: 'rejected' } : null));
        }
      }
    });

    // Initial fetch from Supabase if connected
    if (isLiveSupabase && household?.id) {
      fetchHouseholdDataFromSupabase(household.id).then((data) => {
        if (data.household) {
          const serverHh = data.household;
          const curr = currentUserRef.current;
          const isCreator = Boolean(serverHh.creatorId && curr.id === serverHh.creatorId);
          const currentInMembers = serverHh.members?.find(
            (m) =>
              m.id === curr.id ||
              (curr.displayName &&
                m.displayName.trim().toLowerCase() === curr.displayName.trim().toLowerCase())
          );

          if (serverHh.members && serverHh.members.length > 0 && !currentInMembers && !isCreator) {
            // Current user was removed from this household by admin
            setHouseholds((prev) => prev.filter((h) => h.id !== serverHh.id));
            setActiveHouseholdId((prev) => (prev === serverHh.id ? null : prev));
            try {
              const updated = households.filter((h) => h.id !== serverHh.id);
              localStorage.setItem(HOUSEHOLDS_STORAGE_KEY, JSON.stringify(updated));
              localStorage.removeItem(ACTIVE_HOUSEHOLD_ID_KEY);
            } catch {}
            setRecipes([]);
            setMealPlan(normalizeMealPlan([]));
            setShoppingList([]);
            return;
          }

          setHouseholds((prev) => {
            const exists = prev.some((h) => h.id === serverHh.id);
            if (exists) {
              return prev.map((h) => (h.id === serverHh.id ? { ...h, ...serverHh } : h));
            }
            return [...prev, serverHh];
          });

          // Sync currentUser role with the household's official member list
          if (currentInMembers) {
            setCurrentUser((prev) => ({
              ...prev,
              id: currentInMembers.id,
              displayName: currentInMembers.displayName,
              initials: currentInMembers.initials,
              roleTitle: currentInMembers.roleTitle,
              isAdmin: currentInMembers.isAdmin,
            }));
          }
        }

        const currentRecs = data.recipes !== undefined ? data.recipes.map(sanitizeRecipe) : recipes;
        if (data.recipes !== undefined) {
          setRecipes(currentRecs);
        }
        if (data.mealPlan !== undefined && data.mealPlan.length > 0) {
          setMealPlan(normalizeMealPlan(data.mealPlan, currentRecs));
        }
        if (data.shoppingItems !== undefined && data.shoppingItems.length > 0) {
          setShoppingList(data.shoppingItems);
        }
      }).finally(() => setHouseholdLoaded(true));
    } else {
      setHouseholdLoaded(true);
    }

    const unsubscribeSupabase = (household && household.id)
      ? subscribeToSupabaseRealtime(household.id, {
          onRecipeChange: (payload) => {
            setLastSyncTimestamp(Date.now());
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const rec = mapRowToRecipe(payload.new);
              setRecipes((prev) => {
                const exists = prev.some((r) => r.id === rec.id);
                if (exists) {
                  return prev.map((r) => (r.id === rec.id ? rec : r));
                }
                return [rec, ...prev];
              });
              if (selectedRecipe?.id === rec.id) {
                setSelectedRecipe(rec);
              }
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              setRecipes((prev) => {
                const remaining = prev.filter((r) => r.id !== deletedId);
                // Also purge any mealPlan references to this deleted recipe
                setMealPlan((mPrev) => normalizeMealPlan(mPrev, remaining));
                return remaining;
              });
            }
          },
          onMealPlanChange: () => {
            setLastSyncTimestamp(Date.now());
            if (household?.id) {
              fetchHouseholdDataFromSupabase(household.id).then((data) => {
                if (data.mealPlan && data.mealPlan.length > 0) {
                  setMealPlan(normalizeMealPlan(data.mealPlan, data.recipes || recipes));
                }
              });
            }
          },
          onShoppingChange: (payload: any) => {
            setLastSyncTimestamp(Date.now());

            if (!payload || !payload.eventType) {
              if (household?.id) {
                fetchHouseholdDataFromSupabase(household.id).then((data) => {
                  if (data.shoppingItems) setShoppingList(data.shoppingItems);
                });
              }
              return;
            }

            if (payload.eventType === 'INSERT') {
              const newItem = mapRowToShoppingItem(payload.new);
              // Ignore server echo if we recently added this item locally (< 2500ms ago)
              const lastLocalUpdate = recentLocalShoppingUpdatesRef.current.get(newItem.id);
              if (lastLocalUpdate && Date.now() - lastLocalUpdate < 2500) {
                return;
              }

              setShoppingList((prev) => {
                const { mergedList } = mergeIngredientsIntoShoppingList(prev, [newItem]);
                return mergedList;
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedItem = mapRowToShoppingItem(payload.new);
              // Ignore server echo if we recently updated this item locally (< 2500ms ago)
              const lastLocalUpdate = recentLocalShoppingUpdatesRef.current.get(updatedItem.id);
              if (lastLocalUpdate && Date.now() - lastLocalUpdate < 2500) {
                return;
              }

              setShoppingList((prev) =>
                prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
              );
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                setShoppingList((prev) => prev.filter((i) => i.id !== deletedId));
              }
            }
          },
          onJoinRequestChange: (_payload: any) => {
            if (household?.id && isHouseholdAdmin) {
              fetchJoinRequestsFromSupabase(household.id).then(setJoinRequests);
            }
          },
          onProfileChange: () => {
            setLastSyncTimestamp(Date.now());
            if (household?.id) {
              if (isHouseholdAdmin) {
                fetchJoinRequestsFromSupabase(household.id).then(setJoinRequests);
              }
              fetchHouseholdDataFromSupabase(household.id).then((data) => {
                if (data.household) {
                  const serverHh = data.household;
                  const curr = currentUserRef.current;
                  const isCreator = Boolean(serverHh.creatorId && curr.id === serverHh.creatorId);
                  const currentInMembers = serverHh.members?.find(
                    (m) =>
                      m.id === curr.id ||
                      (curr.displayName &&
                        m.displayName.trim().toLowerCase() === curr.displayName.trim().toLowerCase())
                  );

                  if (serverHh.members && serverHh.members.length > 0 && !currentInMembers && !isCreator) {
                    // Current user was removed from this household
                    setHouseholds((prev) => prev.filter((h) => h.id !== serverHh.id));
                    setActiveHouseholdId((prev) => (prev === serverHh.id ? null : prev));
                    try {
                      const updated = households.filter((h) => h.id !== serverHh.id);
                      localStorage.setItem(HOUSEHOLDS_STORAGE_KEY, JSON.stringify(updated));
                      localStorage.removeItem(ACTIVE_HOUSEHOLD_ID_KEY);
                    } catch {}
                    setRecipes([]);
                    setMealPlan(normalizeMealPlan([]));
                    setShoppingList([]);
                    return;
                  }

                  setHouseholds((prev) =>
                    prev.map((h) => (h.id === serverHh.id ? { ...h, ...serverHh } : h))
                  );
                  if (currentInMembers) {
                    setCurrentUser((prev) => ({
                      ...prev,
                      id: currentInMembers.id,
                      displayName: currentInMembers.displayName,
                      initials: currentInMembers.initials,
                      roleTitle: currentInMembers.roleTitle,
                      isAdmin: currentInMembers.isAdmin,
                    }));
                  }
                }
              });
            }
          },
          onHouseholdChange: () => {
            setLastSyncTimestamp(Date.now());
            if (household?.id) {
              fetchHouseholdDataFromSupabase(household.id).then((data) => {
                if (data.household) {
                  const serverHh = data.household;
                  setHouseholds((prev) =>
                    prev.map((h) => (h.id === serverHh.id ? { ...h, ...serverHh } : h))
                  );
                }
              });
            }
          },
        })
      : () => {};

    const pendingTimeouts = pendingShoppingCheckedTimeoutsRef.current;
    return () => {
      unsubscribeLocal();
      unsubscribeSupabase();
      pendingTimeouts.forEach((t) => clearTimeout(t));
      pendingTimeouts.clear();
    };
  }, [household?.id, selectedRecipe?.id, isLiveSupabase, isHouseholdAdmin]);

  // Fetch pending join requests for Admin
  useEffect(() => {
    if (isLiveSupabase && household?.id && isHouseholdAdmin) {
      fetchJoinRequestsFromSupabase(household.id).then(setJoinRequests);

      // Periodic check every 8 seconds so admin on phone never misses a request
      const interval = setInterval(() => {
        fetchJoinRequestsFromSupabase(household.id).then(setJoinRequests);
      }, 8000);

      return () => clearInterval(interval);
    } else if (!isHouseholdAdmin) {
      setJoinRequests([]);
    }
  }, [isLiveSupabase, household?.id, isHouseholdAdmin]);

  // Share aisle choices between household members
  useEffect(() => {
    if (!isLiveSupabase || !household?.id) return;

    let isMounted = true;
    const applyAisleOverrides = () => {
      setShoppingList((prev) =>
        prev.map((item) => {
          const aisle = getAisleOverride(item.name);
          return aisle && aisle !== item.aisle ? { ...item, aisle } : item;
        })
      );
    };

    syncAisleOverridesWithSupabase(household.id).then(() => {
      if (isMounted) applyAisleOverrides();
    });
    const unsubscribe = subscribeToAisleOverrides(household.id, applyAisleOverrides);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isLiveSupabase, household?.id]);

  // Listen for approval/rejection of current user's pending join request
  useEffect(() => {
    if (!pendingJoin || pendingJoin.status !== 'pending') return;

    let isMounted = true;

    const handleApproved = async () => {
      if (!isMounted) return;
      const data = await fetchHouseholdDataFromSupabase(pendingJoin.householdId);
      if (!isMounted) return;

      const updatedMembers = [
        ...(data.household?.members || []),
        {
          id: currentUser.id,
          displayName: pendingJoin.displayName,
          initials: (pendingJoin.displayName || 'M').charAt(0).toUpperCase(),
          roleTitle: 'Medlem',
          isAdmin: false,
        },
      ];

      const updatedHh: Household = {
        id: pendingJoin.householdId,
        name: pendingJoin.householdName,
        joinCode: pendingJoin.joinCode,
        creatorId: data.household?.creatorId,
        members: updatedMembers,
      };

      setHouseholds((prev) => {
        const exists = prev.find((h) => h.id === updatedHh.id);
        if (exists) {
          return prev.map((h) => (h.id === updatedHh.id ? updatedHh : h));
        }
        return [...prev, updatedHh];
      });

      setActiveHouseholdId(pendingJoin.householdId);
      setCurrentUser({
        id: currentUser.id,
        displayName: pendingJoin.displayName,
        initials: (pendingJoin.displayName || 'M').charAt(0).toUpperCase(),
        roleTitle: 'Medlem',
        isAdmin: false,
      });

      if (data.recipes !== undefined) setRecipes(data.recipes.map(sanitizeRecipe));
      if (data.mealPlan && data.mealPlan.length > 0) {
        setMealPlan(normalizeMealPlan(data.mealPlan, data.recipes || recipes));
      }
      if (data.shoppingItems !== undefined) setShoppingList(data.shoppingItems);

      setPendingJoin(null);
    };

    const unsubscribe = isLiveSupabase
      ? subscribeToJoinRequestApproval(
          pendingJoin.requestId,
          (status) => {
            if (!isMounted) return;
            if (status === 'approved') {
              handleApproved();
            } else if (status === 'rejected') {
              setPendingJoin((prev) => (prev ? { ...prev, status: 'rejected' } : null));
            }
          },
          pendingJoin.householdId,
          currentUser.id
        )
      : () => {};

    const interval = setInterval(async () => {
      if (!isMounted || !isLiveSupabase) return;
      const status = await checkJoinRequestStatusInSupabase(pendingJoin.requestId, currentUser.id);
      if (!isMounted || !status) return;

      if (status === 'approved') {
        handleApproved();
      } else if (status === 'rejected') {
        setPendingJoin((prev) => (prev ? { ...prev, status: 'rejected' } : null));
      }
    }, 2500);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [pendingJoin, isLiveSupabase, currentUser.id, recipes]);
}
