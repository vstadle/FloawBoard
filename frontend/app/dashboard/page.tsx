'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchAPI, getToken, removeToken } from '@/lib/api';

interface Board {
  id: string;
  title: string;
  created_at?: string;
}

export default function DashboardPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Menu States
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number }>({ top: 0, left: 0 });
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingBoardTitle, setEditingBoardTitle] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    fetchAPI('/boards')
      .then((data) => setBoards(data))
      .catch((err) => setError(err.message));
  }, [router]);

  // Click outside listener for menu
  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setOpenMenuId(null);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", () => setOpenMenuId(null), true);
      return () => {
          document.removeEventListener("mousedown", handleClickOutside);
      };
  }, []);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;

    try {
      const newBoard = await fetchAPI('/boards', {
        method: 'POST',
        body: JSON.stringify({ title: newBoardTitle }),
      });
      setBoards([...boards, newBoard]);
      setNewBoardTitle('');
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create board');
    }
  };

  const handleLogout = () => {
    removeToken();
    router.push('/login');
  };

  const handleOpenMenu = (e: React.MouseEvent, boardId: string) => {
      e.preventDefault(); // Prevent navigation
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 5, left: rect.right - 150 });
      setOpenMenuId(openMenuId === boardId ? null : boardId);
  };

  const deleteBoard = async (boardId: string) => {
      if (!confirm("Are you sure you want to delete this board?")) return;

      try {
          await fetchAPI(`/boards/${boardId}`, { method: 'DELETE' });
          setBoards(boards.filter(b => b.id !== boardId));
          setOpenMenuId(null);
      } catch (err) {
          console.error(err);
      }
  };

  const startEditingBoard = (board: Board) => {
      setEditingBoardId(board.id);
      setEditingBoardTitle(board.title);
      setOpenMenuId(null);
  };

  const saveBoardTitle = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingBoardId || !editingBoardTitle.trim()) return;

      try {
          const updatedBoard = await fetchAPI(`/boards/${editingBoardId}`, {
              method: 'PUT',
              body: JSON.stringify({ title: editingBoardTitle })
          });
          setBoards(boards.map(b => b.id === editingBoardId ? updatedBoard : b));
          setEditingBoardId(null);
      } catch (err) {
          console.error(err);
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-indigo-200 shadow-lg">F</div>
            <span className="font-bold text-xl tracking-tight">FloawBoard</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-end mb-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Your Workspaces</h1>
                <p className="mt-1 text-gray-500">Manage your projects and tasks.</p>
            </div>
            <button
                onClick={() => setIsModalOpen(true)}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Create Board
            </button>
        </div>

        {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/board/${board.id}`}
              className="group block bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:ring-2 hover:ring-indigo-100 hover:shadow-lg transition-all duration-200 overflow-hidden relative"
            >
              <div className="h-2 bg-indigo-500 w-full group-hover:h-3 transition-all"></div>
              <div className="p-6">
                <div className="flex justify-between items-start">
                    <h2 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2 truncate pr-6">
                    {board.title}
                    </h2>
                    
                    <button 
                        onClick={(e) => handleOpenMenu(e, board.id)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors absolute top-4 right-4"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                    </button>
                </div>
                
                <div className="flex items-center text-xs text-gray-400 mt-4">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md">Project</span>
                    <span className="mx-2">•</span>
                    <span>Last updated recently</span>
                </div>
              </div>
            </Link>
          ))}
          
            {/* Empty State / Create Placeholder */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-gray-500 hover:text-indigo-600 min-h-[160px]"
            >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3 group-hover:bg-indigo-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </div>
                <span className="font-medium">Create new board</span>
            </button>
        </div>
      </main>

      {/* Fixed Menu Portal */}
      {openMenuId && (
        <div 
          ref={menuRef} 
          style={{ top: menuPosition.top, left: menuPosition.left }}
          className="fixed w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1 text-sm text-gray-700 animate-in fade-in zoom-in duration-200"
        >
            <button 
                onClick={() => {
                  const board = boards.find(b => b.id === openMenuId);
                  if (board) startEditingBoard(board);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
            >
                Edit
            </button>
            <div className="h-px bg-gray-100 my-1"></div>
            <button 
                onClick={() => deleteBoard(openMenuId)}
                className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
            >
                Delete
            </button>
        </div>
      )}

      {/* Edit Board Modal */}
      {editingBoardId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">Edit Board</h3>
                    <button onClick={() => setEditingBoardId(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={saveBoardTitle} className="p-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Board Title</label>
                    <input
                        type="text"
                        autoFocus
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        value={editingBoardTitle}
                        onChange={(e) => setEditingBoardTitle(e.target.value)}
                    />
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setEditingBoardId(null)}
                            className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Create Modal (Existing) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">Create New Board</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleCreateBoard} className="p-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Board Title</label>
                    <input
                        type="text"
                        autoFocus
                        placeholder="e.g., Q4 Roadmap"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        value={newBoardTitle}
                        onChange={(e) => setNewBoardTitle(e.target.value)}
                    />
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                        >
                            Create Board
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
