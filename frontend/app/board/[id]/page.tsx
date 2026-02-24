'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAPI, getToken } from '@/lib/api';
import { createPortal } from 'react-dom';

interface Card {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  position: number;
  created_at?: string;
}

interface List {
  id: string;
  title: string;
  cards: Card[];
  position: number;
}

interface Board {
  id: string;
  user_id: string;
  title: string;
  members: string[];
  owner_email: string;
  owner_username: string;
}

const PRIORITY_COLORS = {
    low: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    high: 'bg-red-100 text-red-700 border-red-200',
};

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const boardId = unwrappedParams.id;
  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string, email: string } | null>(null);
  const [newListTitle, setNewListTitle] = useState('');
  
  // Create Card States
  const [newCardTitles, setNewCardTitles] = useState<{ [key: string]: string }>({});
  const [newCardPriority, setNewCardPriority] = useState<{ [key: string]: 'low' | 'medium' | 'high' }>({});

  const [isAddingList, setIsAddingList] = useState(false);
  
  // Menu states
  const [openMenuListId, setOpenMenuListId] = useState<string | null>(null);
  const [openMenuCardId, setOpenMenuCardId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number }>({ top: 0, left: 0 });
  
  // Edit states
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListTitle, setEditingListTitle] = useState('');
  
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardTitle, setEditingCardTitle] = useState('');
  const [editingCardPriority, setEditingCardPriority] = useState<'low' | 'medium' | 'high'>('low');

  // Drag and Drop state
  const [draggedCard, setDraggedCard] = useState<{ cardId: string, sourceListId: string } | null>(null);

  // Per-List Settings State (Sort & Filter)
  type SortOption = 'manual' | 'date-newest' | 'date-oldest' | 'priority-high' | 'priority-low';
  interface ListSettings {
      sortBy: SortOption;
      filterPriority: 'all' | 'low' | 'medium' | 'high';
      filterText: string;
      isSettingsOpen: boolean; // To toggle the settings popover
  }
  const [listSettings, setListSettings] = useState<{ [key: string]: ListSettings }>({});

  const getListSettings = (listId: string): ListSettings => {
      return listSettings[listId] || { 
          sortBy: 'manual', 
          filterPriority: 'all', 
          filterText: '',
          isSettingsOpen: false
      };
  };

  const updateListSettings = (listId: string, updates: Partial<ListSettings>) => {
      setListSettings(prev => ({
          ...prev,
          [listId]: { ...getListSettings(listId), ...updates }
      }));
  };

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareMessage, setShareMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Custom Confirm Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  } | null>(null);

  const menuListRef = useRef<HTMLDivElement>(null);
  const menuCardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      try {
        const [userData, boardData] = await Promise.all([
            fetchAPI('/me'),
            fetchAPI(`/boards/${boardId}`)
        ]);
        setCurrentUser(userData);
        setBoard(boardData);

        const listsData: List[] = await fetchAPI(`/boards/${boardId}/lists`);
        
        const listsWithCards = await Promise.all(
          listsData.map(async (list) => {
            const cards = await fetchAPI(`/lists/${list.id}/cards`);
            return { ...list, cards };
          })
        );
        
        setLists(listsWithCards);
      } catch (err) {
        console.error(err);
      }
    };

    loadData();
  }, [boardId, router]);

  // Click outside listeners
  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (menuListRef.current && !menuListRef.current.contains(event.target as Node)) {
              setOpenMenuListId(null);
          }
          if (menuCardRef.current && !menuCardRef.current.contains(event.target as Node)) {
              setOpenMenuCardId(null);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", () => { setOpenMenuListId(null); setOpenMenuCardId(null); }, true); 
      return () => {
          document.removeEventListener("mousedown", handleClickOutside);
      };
  }, []);

  const handleOpenListMenu = (e: React.MouseEvent, listId: string) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 5, left: rect.right - 192 }); 
      setOpenMenuListId(openMenuListId === listId ? null : listId);
      setOpenMenuCardId(null);
  };

  const handleOpenCardMenu = (e: React.MouseEvent, cardId: string) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 5, left: rect.right - 128 });
      setOpenMenuCardId(openMenuCardId === cardId ? null : cardId);
      setOpenMenuListId(null);
  };

  const handleShareBoard = async (e: React.FormEvent) => {
      e.preventDefault();
      setShareMessage(null);
      
      try {
          await fetchAPI(`/boards/${boardId}/members`, {
              method: 'POST',
              body: JSON.stringify({ email: shareEmail })
          });
          setShareMessage({ type: 'success', text: 'User invited successfully!' });
          setShareEmail('');
          
          // Refresh board details to update the members list
          const updatedBoardData = await fetchAPI(`/boards/${boardId}`);
          setBoard(updatedBoardData);
      } catch (err: any) {
          setShareMessage({ type: 'error', text: err.message || 'Failed to invite user.' });
      }
  };

  const handleRemoveMember = async (username: string) => {
      setConfirmConfig({
          isOpen: true,
          title: 'Remove Member',
          message: `Are you sure you want to remove ${username} from this board?`,
          onConfirm: async () => {
              try {
                  await fetchAPI(`/boards/${boardId}/members/${username}`, {
                      method: 'DELETE'
                  });
                  const updatedBoardData = await fetchAPI(`/boards/${boardId}`);
                  setBoard(updatedBoardData);
                  setConfirmConfig(null);
              } catch (err: any) {
                  alert(err.message || 'Failed to remove member.');
                  setConfirmConfig(null);
              }
          }
      });
  };

  // --- DRAG AND DROP ---

  const handleDragStart = (e: React.DragEvent, cardId: string, listId: string) => {
      setDraggedCard({ cardId, sourceListId: listId });
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetListId: string, targetCardId?: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedCard) return;

      const { cardId, sourceListId } = draggedCard;
      // If dropping on the same card, do nothing
      if (cardId === targetCardId) {
          setDraggedCard(null);
          return;
      }

      const sourceListIndex = lists.findIndex(l => l.id === sourceListId);
      const targetListIndex = lists.findIndex(l => l.id === targetListId);
      
      if (sourceListIndex === -1 || targetListIndex === -1) return;

      const newLists = [...lists];
      const sourceList = { ...newLists[sourceListIndex], cards: [...newLists[sourceListIndex].cards] };
      const targetList = sourceListId === targetListId 
          ? sourceList 
          : { ...newLists[targetListIndex], cards: [...newLists[targetListIndex].cards] };

      // 1. Remove from source
      const cardIndex = sourceList.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return;
      const [cardToMove] = sourceList.cards.splice(cardIndex, 1);

      // 2. Insert into target
      let newPositionIndex;
      if (targetCardId) {
          const targetCardIndexInModified = targetList.cards.findIndex(c => c.id === targetCardId);
          
          if (sourceListId === targetListId) {
              // Within same list: determine if we are moving up or down
              const originalTargetIndex = lists[sourceListIndex].cards.findIndex(c => c.id === targetCardId);
              if (cardIndex < originalTargetIndex) {
                  // Moving DOWN: insert AFTER the target
                  newPositionIndex = targetCardIndexInModified + 1;
              } else {
                  // Moving UP: insert BEFORE the target
                  newPositionIndex = targetCardIndexInModified;
              }
          } else {
              // Different list: always insert BEFORE target
              newPositionIndex = targetCardIndexInModified !== -1 ? targetCardIndexInModified : targetList.cards.length;
          }
      } else {
          newPositionIndex = targetList.cards.length;
      }
      
      targetList.cards.splice(newPositionIndex, 0, cardToMove);

      // 3. Update positions in the target list objects
      targetList.cards.forEach((c, index) => {
          c.position = index;
      });

      // Update state
      newLists[sourceListIndex] = sourceList;
      if (sourceListId !== targetListId) {
          newLists[targetListIndex] = targetList;
      }
      setLists(newLists);
      setDraggedCard(null);

      // 4. Send API updates for all cards in the target list whose position changed (or the moved card)
      // Optimistically update all to ensure consistency.
      try {
          // We can just update all cards in the target list to be safe and simple
          await Promise.all(targetList.cards.map((c, index) => {
               // Only update if it's the moved card OR if its position in DB (likely) is different.
               // Since we don't track DB state perfectly, updating all is safer for prototype.
               return fetchAPI(`/cards/${c.id}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                      list_id: targetListId,
                      position: index,
                  })
              });
          }));
      } catch (err) {
          console.error("Failed to update card positions", err);
      }
  };

  // --- LIST ACTIONS ---

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;

    try {
      const newList = await fetchAPI(`/boards/${boardId}/lists`, {
        method: 'POST',
        body: JSON.stringify({
          title: newListTitle,
          position: lists.length,
        }),
      });
      setLists([...lists, { ...newList, cards: [] }]);
      setNewListTitle('');
      setIsAddingList(false);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteList = async (listId: string) => {
      setConfirmConfig({
          isOpen: true,
          title: 'Delete List',
          message: 'Are you sure you want to delete this list and all its cards? This action cannot be undone.',
          onConfirm: async () => {
              try {
                  await fetchAPI(`/lists/${listId}`, { method: 'DELETE' });
                  setLists(lists.filter(l => l.id !== listId));
                  setOpenMenuListId(null);
                  setConfirmConfig(null);
              } catch (err) {
                  console.error(err);
                  setConfirmConfig(null);
              }
          }
      });
  };

  const startEditingList = (list: List) => {
      setEditingListId(list.id);
      setEditingListTitle(list.title);
      setOpenMenuListId(null);
  };

  const saveListTitle = async (listId: string) => {
      if (!editingListTitle.trim()) return;

      try {
           const updatedList = await fetchAPI(`/lists/${listId}`, {
              method: 'PUT',
              body: JSON.stringify({ title: editingListTitle })
          });
          
          setLists(lists.map(l => l.id === listId ? { ...l, title: updatedList.title } : l));
          setEditingListId(null);
      } catch (err) {
          console.error(err);
      }
  };

  // --- CARD ACTIONS ---

  const handleCreateCard = async (e: React.FormEvent, listId: string) => {
    e.preventDefault();
    const title = newCardTitles[listId];
    if (!title?.trim()) return;

    const priority = newCardPriority[listId] || 'low';

    try {
      const targetList = lists.find(l => l.id === listId);
      const position = targetList ? targetList.cards.length : 0;

      const newCard = await fetchAPI(`/lists/${listId}/cards`, {
        method: 'POST',
        body: JSON.stringify({
          title: title,
          position: position,
          description: '',
          priority: priority,
        }),
      });

      setLists(lists.map(list => {
        if (list.id === listId) {
          return { ...list, cards: [...list.cards, newCard] };
        }
        return list;
      }));
      
      setNewCardTitles({ ...newCardTitles, [listId]: '' });
      setNewCardPriority({ ...newCardPriority, [listId]: 'low' });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCard = async (cardId: string, listId: string) => {
      setConfirmConfig({
          isOpen: true,
          title: 'Delete Card',
          message: 'Are you sure you want to delete this card?',
          onConfirm: async () => {
              try {
                  await fetchAPI(`/cards/${cardId}`, { method: 'DELETE' });
                  setLists(lists.map(list => {
                      if (list.id === listId) {
                          return { ...list, cards: list.cards.filter(c => c.id !== cardId) };
                      }
                      return list;
                  }));
                  setOpenMenuCardId(null);
                  setConfirmConfig(null);
              } catch (err) {
                  console.error(err);
                  setConfirmConfig(null);
              }
          }
      });
  };

  const startEditingCard = (card: Card) => {
      setEditingCardId(card.id);
      setEditingCardTitle(card.title);
      setEditingCardPriority(card.priority);
      setOpenMenuCardId(null);
  };

  const saveCardChanges = async (cardId: string, listId: string) => {
      if (!editingCardTitle.trim()) return;

      try {
          const updatedCard = await fetchAPI(`/cards/${cardId}`, {
              method: 'PUT',
              body: JSON.stringify({ 
                  title: editingCardTitle,
                  priority: editingCardPriority
              })
          });

          setLists(lists.map(list => {
              if (list.id === listId) {
                  return { 
                      ...list, 
                      cards: list.cards.map(c => c.id === cardId ? updatedCard : c) 
                  };
              }
              return list;
          }));
          setEditingCardId(null);
      } catch (err) {
          console.error(err);
      }
  };

  if (!board) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* Board Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm z-10 h-16">
        <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">{board.title}</h1>
        </div>

        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsShareModalOpen(true)}
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Share
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <button 
                onClick={() => router.push('/dashboard')} 
                className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Dashboard
            </button>
        </div>
      </header>

      {/* Board Canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex gap-6 h-full items-start">
          {lists.map((list) => {
            const settings = getListSettings(list.id);
            // Only disable drag and drop if a sort or filter is ACTUALLY active.
            // Opening the settings menu itself should not disable DND.
            const hasActiveFilter = settings.filterText !== '' || settings.filterPriority !== 'all' || settings.sortBy !== 'manual';
            
            return (
            <div 
                key={list.id} 
                className="min-w-[280px] w-[280px] bg-gray-100 rounded-2xl p-3 flex flex-col max-h-full border border-gray-200/60 shadow-sm relative transition-colors"
                onDragOver={handleDragOver}
                onDrop={(e) => !hasActiveFilter && handleDrop(e, list.id)}
            >
              {/* List Header */}
              <div className="flex justify-between items-center px-3 py-2 mb-1 relative">
                  {editingListId === list.id ? (
                      <input 
                          type="text"
                          autoFocus
                          value={editingListTitle}
                          onChange={(e) => setEditingListTitle(e.target.value)}
                          onBlur={() => saveListTitle(list.id)}
                          onKeyDown={(e) => {
                              if(e.key === 'Enter') saveListTitle(list.id);
                          }}
                          className="w-full text-sm font-semibold text-gray-700 bg-white border border-indigo-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                  ) : (
                      <h3 
                          onClick={() => startEditingList(list)}
                          className="font-semibold text-gray-700 text-sm cursor-pointer hover:bg-gray-200 px-2 py-1 rounded w-full truncate flex items-center gap-2"
                      >
                          <span className="truncate">{list.title}</span>
                          <span className="text-gray-400 font-normal">({list.cards.length})</span>
                      </h3>
                  )}
                  
                  <div className="flex items-center gap-1">
                      {/* Filter/Sort Toggle */}
                      <button
                          onClick={() => updateListSettings(list.id, { isSettingsOpen: !getListSettings(list.id).isSettingsOpen })}
                          className={`p-1 rounded transition-colors ${getListSettings(list.id).isSettingsOpen ? 'bg-gray-200 text-gray-700' : hasActiveFilter ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'}`}
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                          </svg>
                      </button>

                      <button 
                          onClick={(e) => handleOpenListMenu(e, list.id)}
                          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200/50 transition-colors"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                          </svg>
                      </button>
                  </div>
              </div>

              {/* List Settings Popover */}
              {getListSettings(list.id).isSettingsOpen && (
                  <div className="mb-3 px-1">
                      <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm space-y-3">
                          {/* Search */}
                          <div>
                              <input 
                                  type="text" 
                                  placeholder="Search tasks..." 
                                  className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                                  value={getListSettings(list.id).filterText}
                                  onChange={(e) => updateListSettings(list.id, { filterText: e.target.value })}
                              />
                          </div>
                          
                          {/* Sort */}
                          <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sort By</p>
                              <select 
                                  className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                                  value={getListSettings(list.id).sortBy}
                                  onChange={(e) => updateListSettings(list.id, { sortBy: e.target.value as any })}
                              >
                                  <option value="manual">Manual (Drag & Drop)</option>
                                  <option value="priority-high">Priority (High → Low)</option>
                                  <option value="priority-low">Priority (Low → High)</option>
                                  <option value="date-newest">Newest First</option>
                                  <option value="date-oldest">Oldest First</option>
                              </select>
                          </div>

                           {/* Priority Filter */}
                           <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Priority</p>
                              <div className="flex gap-1">
                                  {['all', 'low', 'medium', 'high'].map((p) => (
                                      <button
                                          key={p}
                                          onClick={() => updateListSettings(list.id, { filterPriority: p as any })}
                                          className={`flex-1 text-[10px] py-1 rounded border capitalize ${getListSettings(list.id).filterPriority === p ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                      >
                                          {p}
                                      </button>
                                  ))}
                              </div>
                           </div>

                           {hasActiveFilter && (
                               <button
                                   onClick={() => updateListSettings(list.id, { 
                                       filterText: '', 
                                       filterPriority: 'all', 
                                       sortBy: 'manual',
                                       isSettingsOpen: false 
                                   })}
                                   className="w-full text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 py-1.5 border border-indigo-100 rounded-lg hover:bg-indigo-50 transition-colors"
                               >
                                   Clear and close filters
                               </button>
                           )}
                      </div>
                  </div>
              )}
              
              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-3 px-1 min-h-[10px] custom-scrollbar pb-2">
                {list.cards
                .filter(card => {
                    const settings = getListSettings(list.id);
                    const matchesSearch = card.title.toLowerCase().includes(settings.filterText.toLowerCase());
                    const matchesPriority = settings.filterPriority === 'all' || card.priority === settings.filterPriority;
                    return matchesSearch && matchesPriority;
                })
                .sort((a, b) => {
                    const sortBy = getListSettings(list.id).sortBy;
                    if (sortBy === 'manual') return a.position - b.position;
                    
                    if (sortBy === 'priority-high') {
                        const pMap = { high: 3, medium: 2, low: 1 };
                        return pMap[b.priority] - pMap[a.priority];
                    }
                    if (sortBy === 'priority-low') {
                        const pMap = { high: 3, medium: 2, low: 1 };
                        return pMap[a.priority] - pMap[b.priority];
                    }
                    if (sortBy === 'date-newest') {
                        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return dateB - dateA;
                    }
                    if (sortBy === 'date-oldest') {
                         const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return dateA - dateB;
                    }
                    
                    return 0;
                })
                .map((card) => (
                  <div 
                    key={card.id} 
                    draggable={!hasActiveFilter && editingCardId !== card.id}
                    onDragStart={(e) => handleDragStart(e, card.id, list.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => !hasActiveFilter && handleDrop(e, list.id, card.id)}
                    className={`group bg-white p-3 rounded-xl shadow-sm border border-gray-200 hover:border-indigo-300 hover:ring-2 hover:ring-indigo-50/50 cursor-pointer transition-all duration-200 relative`}
                  >
                    {editingCardId === card.id ? (
                        <div className="space-y-3">
                             <textarea
                                className="w-full px-2 py-1 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                rows={2}
                                autoFocus
                                value={editingCardTitle}
                                onChange={(e) => setEditingCardTitle(e.target.value)}
                            />
                            
                            <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Priority</label>
                                <select
                                    value={editingCardPriority}
                                    onChange={(e) => setEditingCardPriority(e.target.value as 'low' | 'medium' | 'high')}
                                    className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>

                            <div className="flex gap-2 justify-end">
                                <button 
                                    onClick={() => setEditingCardId(null)}
                                    className="text-gray-500 text-xs px-2 py-1 rounded hover:bg-gray-100"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => saveCardChanges(card.id, list.id)}
                                    className="bg-indigo-600 text-white text-xs px-3 py-1 rounded hover:bg-indigo-700 shadow-sm"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-start mb-2">
                                <div className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[card.priority]}`}>
                                    {card.priority}
                                </div>
                                <button 
                                    onClick={(e) => handleOpenCardMenu(e, card.id)}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100 transition-opacity"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                                    </svg>
                                </button>
                            </div>
                            
                            <p className="text-sm text-gray-800 font-medium leading-snug w-full break-words">{card.title}</p>
                        </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Card Input */}
              <form onSubmit={(e) => handleCreateCard(e, list.id)} className="mt-2 px-1">
                {newCardTitles[list.id] ? (
                    <div className="space-y-2 p-1">
                         <textarea
                            placeholder="Enter a title for this card..."
                            className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none resize-none shadow-sm"
                            rows={3}
                            autoFocus
                            value={newCardTitles[list.id]}
                            onChange={(e) => setNewCardTitles({ ...newCardTitles, [list.id]: e.target.value })}
                            onKeyDown={(e) => {
                                if(e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCreateCard(e, list.id);
                                }
                            }}
                        />
                        
                        <div className="flex gap-2">
                             <select
                                value={newCardPriority[list.id] || 'low'}
                                onChange={(e) => setNewCardPriority({ ...newCardPriority, [list.id]: e.target.value as any })}
                                className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 flex-1 bg-white"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 justify-between">
                            <button 
                                type="button" 
                                onClick={() => setNewCardTitles({ ...newCardTitles, [list.id]: '' })}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded text-xs"
                            >
                                Cancel
                            </button>
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm">
                                Add Card
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setNewCardTitles({ ...newCardTitles, [list.id]: ' ' })} // Set non-empty to trigger input view
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 hover:bg-gray-200/60 w-full px-2 py-1.5 rounded-lg transition-colors text-sm font-medium group"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add a card
                    </button>
                )}
              </form>
            </div>
            );
          })}

          {/* New List Button */}
          <div className="min-w-[280px]">
            {!isAddingList ? (
                <button
                    onClick={() => setIsAddingList(true)}
                    className="w-full flex items-center gap-2 bg-white/50 hover:bg-white/80 border border-transparent hover:border-gray-300 text-gray-600 font-medium px-4 py-3 rounded-xl transition-all shadow-sm backdrop-blur-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add another list
                </button>
            ) : (
                <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200">
                    <form onSubmit={handleCreateList}>
                        <input
                            type="text"
                            autoFocus
                            placeholder="List title..."
                            className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-2"
                            value={newListTitle}
                            onChange={(e) => setNewListTitle(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm">
                                Add List
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setIsAddingList(false)}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">Share Board</h3>
                    <button onClick={() => setIsShareModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {currentUser?.id === board.user_id && (
                        <form onSubmit={handleShareBoard} className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Invite User</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="Enter email address"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    value={shareEmail}
                                    onChange={(e) => setShareEmail(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
                                >
                                    Invite
                                </button>
                            </div>
                            {shareMessage && (
                                <p className={`mt-3 text-sm ${shareMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {shareMessage.text}
                                </p>
                            )}
                        </form>
                    )}

                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Members</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                                    {board.owner_username.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{board.owner_username}</p>
                                    <p className="text-xs text-gray-500">{board.owner_email} • Owner</p>
                                </div>
                            </div>
                            {board.members.map((member, idx) => (
                                <div key={idx} className="flex items-center gap-3 group/member">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-sm shrink-0">
                                        {member.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{member}</p>
                                        <p className="text-xs text-gray-500">Member</p>
                                    </div>
                                    {currentUser?.id === board.user_id && (
                                        <button 
                                            onClick={() => handleRemoveMember(member)}
                                            className="opacity-0 group-hover/member:opacity-100 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            title="Remove member"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Fixed Menu Portals */}
      {openMenuListId && (
        <div 
          ref={menuListRef} 
          style={{ top: menuPosition.top, left: menuPosition.left }}
          className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1 text-sm text-gray-700 animate-in fade-in zoom-in duration-200"
        >
            <button 
                onClick={() => {
                  const list = lists.find(l => l.id === openMenuListId);
                  if (list) startEditingList(list);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Rename
            </button>
            <div className="h-px bg-gray-100 my-1"></div>
            <button 
                onClick={() => deleteList(openMenuListId)}
                className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
            </button>
        </div>
      )}

      {openMenuCardId && (
        <div 
          ref={menuCardRef} 
          style={{ top: menuPosition.top, left: menuPosition.left }}
          className="fixed w-32 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1 text-xs text-gray-700 animate-in fade-in zoom-in duration-200"
        >
            <button 
                onClick={() => {
                  const list = lists.find(l => l.cards.some(c => c.id === openMenuCardId));
                  const card = list?.cards.find(c => c.id === openMenuCardId);
                  if (card) startEditingCard(card);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
            >
                Edit
            </button>
            <button 
                onClick={() => {
                   const list = lists.find(l => l.cards.some(c => c.id === openMenuCardId));
                   if(list) deleteCard(openMenuCardId, list.id);
                }}
                className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
            >
                Delete
            </button>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmConfig && confirmConfig.isOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform animate-in zoom-in-95 duration-200">
                  <div className="p-6">
                      <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmConfig.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                          {confirmConfig.message}
                      </p>
                  </div>
                  <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                      <button
                          onClick={() => setConfirmConfig(null)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button
                          onClick={confirmConfig.onConfirm}
                          className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                      >
                          Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
