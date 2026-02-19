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
}

interface List {
  id: string;
  title: string;
  cards: Card[];
  position: number;
}

interface Board {
  id: string;
  title: string;
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
        const boardData = await fetchAPI(`/boards/${boardId}`);
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

  // --- DRAG AND DROP ---

  const handleDragStart = (e: React.DragEvent, cardId: string, listId: string) => {
      setDraggedCard({ cardId, sourceListId: listId });
      e.dataTransfer.effectAllowed = "move";
      // Optional: Set a custom drag image or styling here
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetListId: string) => {
      e.preventDefault();
      if (!draggedCard) return;

      const { cardId, sourceListId } = draggedCard;
      if (sourceListId === targetListId) {
          setDraggedCard(null);
          return; // No change if dropped in same list (for now, unless implementing reordering)
      }

      // Optimistic UI Update
      const sourceListIndex = lists.findIndex(l => l.id === sourceListId);
      const targetListIndex = lists.findIndex(l => l.id === targetListId);
      
      if (sourceListIndex === -1 || targetListIndex === -1) return;

      const newLists = [...lists];
      const sourceList = { ...newLists[sourceListIndex] };
      const targetList = { ...newLists[targetListIndex] };

      const cardIndex = sourceList.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return;

      const [cardToMove] = sourceList.cards.splice(cardIndex, 1);
      
      // Calculate new position (append to end)
      // If we implemented dropping ON a card, we'd calculate index here. 
      // For dropping on list, we append.
      const newPosition = targetList.cards.length; 
      const movedCard = { ...cardToMove, position: newPosition };
      
      targetList.cards.push(movedCard);

      newLists[sourceListIndex] = sourceList;
      newLists[targetListIndex] = targetList;

      setLists(newLists);
      setDraggedCard(null);

      // API Call
      try {
          await fetchAPI(`/cards/${cardId}`, {
              method: 'PUT',
              body: JSON.stringify({
                  list_id: targetListId,
                  position: newPosition,
              })
          });
      } catch (err) {
          console.error("Failed to update card position", err);
          // TODO: Revert UI state on failure
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
      if(!confirm("Are you sure you want to delete this list?")) return;
      
      try {
          await fetchAPI(`/lists/${listId}`, { method: 'DELETE' });
          setLists(lists.filter(l => l.id !== listId));
          setOpenMenuListId(null);
      } catch (err) {
          console.error(err);
      }
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
      setNewCardPriority({ ...newCardPriority, [listId]: 'low' }); // Reset priority
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCard = async (cardId: string, listId: string) => {
      if(!confirm("Are you sure you want to delete this card?")) return;

      try {
          await fetchAPI(`/cards/${cardId}`, { method: 'DELETE' });
          setLists(lists.map(list => {
              if (list.id === listId) {
                  return { ...list, cards: list.cards.filter(c => c.id !== cardId) };
              }
              return list;
          }));
          setOpenMenuCardId(null);
      } catch (err) {
          console.error(err);
      }
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
            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100">
                Private
            </span>
        </div>
        <div className="flex items-center gap-3">
            <button className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">
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
          {lists.map((list) => (
            <div 
                key={list.id} 
                className="min-w-[280px] w-[280px] bg-gray-100 rounded-2xl p-3 flex flex-col max-h-full border border-gray-200/60 shadow-sm relative transition-colors"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, list.id)}
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
                          className="font-semibold text-gray-700 text-sm cursor-pointer hover:bg-gray-200 px-2 py-1 rounded w-full truncate"
                      >
                          {list.title}
                      </h3>
                  )}
                  
                  <button 
                      onClick={(e) => handleOpenListMenu(e, list.id)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200/50 transition-colors"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                      </svg>
                  </button>
              </div>
              
              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-3 px-1 min-h-[10px] custom-scrollbar pb-2">
                {list.cards.map((card) => (
                  <div 
                    key={card.id} 
                    draggable={editingCardId !== card.id} // Disable drag when editing
                    onDragStart={(e) => handleDragStart(e, card.id, list.id)}
                    className={`group bg-white p-3 rounded-xl shadow-sm border border-gray-200 hover:border-indigo-300 hover:ring-2 hover:ring-indigo-50/50 cursor-pointer transition-all duration-200 relative ${draggedCard?.cardId === card.id ? 'opacity-50' : ''}`}
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
                            
                            <select
                                value={editingCardPriority}
                                onChange={(e) => setEditingCardPriority(e.target.value as 'low' | 'medium' | 'high')}
                                className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="low">Low Priority (Green)</option>
                                <option value="medium">Medium Priority (Yellow)</option>
                                <option value="high">High Priority (Red)</option>
                            </select>

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
          ))}

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
    </div>
  );
}
