import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { SubwayGrid } from '../classes/SubwayGrid';
import { Tile } from '../types/grid';
import { trainConfigApi, TrainConfigurationResponse } from '../services/api';
import { formatRelativeTime } from '../utils/time';
import Grid from './Grid';
import './ScenarioEditor.css';

interface ScenarioEditorProps {
  initialGrid?: SubwayGrid | null;
}

export default function ScenarioEditor({ initialGrid }: ScenarioEditorProps) {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const studyId = searchParams.get('studyId')
  const [grid, setGrid] = useState<SubwayGrid | null>(initialGrid || null);
  const [name, setName] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<'seat' | 'floor' | 'stanchion' | 'barrier' | 'man' | 'woman' | 'neutral' | 'eraser'>('neutral');
  const [capacity, setCapacity] = useState<number>(50);
  const [menPercentage, setMenPercentage] = useState<number>(50);
  const [womenPercentage, setWomenPercentage] = useState<number>(50);
  const [manuallyPlacedPeople, setManuallyPlacedPeople] = useState<Set<string>>(new Set()); // Track manually placed people by "row-col" key
  const [saving, setSaving] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [savedConfig, setSavedConfig] = useState<TrainConfigurationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showSaveBanner, setShowSaveBanner] = useState(false);
  const [gridHeight, setGridHeight] = useState<number>(20);
  const [gridWidth, setGridWidth] = useState<number>(5);
  const titleDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize grid with sample pattern if dimensions match, otherwise empty
  const initializeGrid = useCallback((height: number, width: number) => {
    const tiles: Tile[][] = [];
    
    // If dimensions match sample grid (20x5), use the sample pattern
    if (height === 20 && width === 5) {
      for (let row = 0; row < height; row++) {
        const rowTiles: Tile[] = [];
        
        // Column 0: First bench column (seats in rows 0-1, 5-14, 18-19; floor in rows 2-4, 15-17)
        if (row >= 0 && row <= 1) {
          // First 2-seat bench
          rowTiles.push({ type: 'seat', occupied: false });
        } else if (row >= 2 && row <= 4) {
          // Door gap - left side (rows 2-4, column 0) - 3 tiles
          rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
        } else if (row >= 5 && row <= 14) {
          // 10-seat bench
          rowTiles.push({ type: 'seat', occupied: false });
        } else if (row >= 15 && row <= 17) {
          // Door gap - left side (rows 15-17, column 0) - 3 tiles
          rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
        } else if (row >= 18 && row <= 19) {
          // Last 2-seat bench
          rowTiles.push({ type: 'seat', occupied: false });
        }
        
        // Columns 1, 2, and 3: Aisle (all floor tiles)
        rowTiles.push({ type: 'floor', occupied: false });
        
        // Column 2: Middle column with stanchions (roughly every 3 rows)
        const isStanchionRow = row % 3 === 2; // Rows 2, 5, 8, 11, 14, 17 (0-indexed)
        rowTiles.push({ 
          type: 'floor', 
          occupied: false,
          isStanchion: isStanchionRow
        });
        
        rowTiles.push({ type: 'floor', occupied: false });
        
        // Column 4: Last bench column (seats in rows 0-1, 5-14, 18-19; floor in rows 2-4, 15-17)
        if (row >= 0 && row <= 1) {
          // First 2-seat bench
          rowTiles.push({ type: 'seat', occupied: false });
        } else if (row >= 2 && row <= 4) {
          // Door gap - right side (rows 2-4, column 4) - 3 tiles
          rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
        } else if (row >= 5 && row <= 14) {
          // 10-seat bench
          rowTiles.push({ type: 'seat', occupied: false });
        } else if (row >= 15 && row <= 17) {
          // Door gap - right side (rows 15-17, column 4) - 3 tiles
          rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
        } else if (row >= 18 && row <= 19) {
          // Last 2-seat bench
          rowTiles.push({ type: 'seat', occupied: false });
        }
        
        tiles.push(rowTiles);
      }
    } else {
      // For other dimensions, create empty floor grid
      for (let row = 0; row < height; row++) {
        const rowTiles: Tile[] = [];
        for (let col = 0; col < width; col++) {
          rowTiles.push({
            type: 'floor',
            occupied: false,
          });
        }
        tiles.push(rowTiles);
      }
    }
    
    setGrid(new SubwayGrid(height, width, tiles));
  }, []);

  // Initialize grid on mount if not provided
  useEffect(() => {
    if (!grid && !initialGrid) {
      initializeGrid(gridHeight, gridWidth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate grid statistics
  const calculateGridStats = useCallback((currentGrid: SubwayGrid) => {
    let totalEligible = 0;
    let occupied = 0;
    let men = 0;
    let women = 0;
    let neutral = 0;

    for (let row = 0; row < currentGrid.height; row++) {
      for (let col = 0; col < currentGrid.width; col++) {
        const tile = currentGrid.getTile(row, col);
        if (!tile) continue;

        // Count eligible tiles (seats and floor, not barriers, doors, or stanchions)
        if (tile.type !== 'barrier' && !tile.isDoor && !tile.isStanchion) {
          totalEligible++;
          if (tile.occupied) {
            occupied++;
            if (tile.person === 'man') men++;
            else if (tile.person === 'woman') women++;
            else if (tile.person === 'neutral') neutral++;
          }
        }
      }
    }

    const capacityPercent = totalEligible > 0 ? Math.round((occupied / totalEligible) * 100) : 0;
    
    // Calculate percentages based only on men and women (exclude neutral)
    const menAndWomen = men + women;
    const menPercent = menAndWomen > 0 ? Math.round((men / menAndWomen) * 100) : 50;
    const womenPercent = menAndWomen > 0 ? Math.round((women / menAndWomen) * 100) : 50;

    return { totalEligible, occupied, men, women, neutral, capacityPercent, menPercent, womenPercent };
  }, []);

  // Update sliders when grid changes (from manual edits)
  // Use a ref to prevent infinite loops
  const isUpdatingFromSlider = useRef(false);
  const isInitialMount = useRef(true);
  
  // Fill grid based on capacity and gender distribution
  const fillGridByCapacity = useCallback((cap: number, menPct: number, womenPct: number) => {
    if (!grid) return;

    const stats = calculateGridStats(grid);
    if (stats.totalEligible === 0) return;

    // If capacity is 0, clear all people (including manually placed)
    if (cap === 0) {
      const newTiles = grid.tiles.map((r) =>
        r.map((t) => ({
          ...t,
          occupied: false,
          person: undefined,
        }))
      );
      isUpdatingFromSlider.current = true;
      setGrid(new SubwayGrid(grid.height, grid.width, newTiles));
      setManuallyPlacedPeople(new Set()); // Clear all manual placements
      setTimeout(() => {
        isUpdatingFromSlider.current = false;
      }, 0);
      return;
    }

    // Collect all eligible tiles
    const eligibleTiles: { row: number; col: number; tile: Tile }[] = [];
    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        const tile = grid.getTile(row, col);
        if (tile && tile.type !== 'barrier' && !tile.isDoor && !tile.isStanchion) {
          eligibleTiles.push({ row, col, tile });
        }
      }
    }

    // Calculate how many tiles should be occupied
    const targetOccupied = Math.round((cap / 100) * stats.totalEligible);
    
    // Separate manually placed people from automatically placed ones
    const manuallyPlaced: Array<{ row: number; col: number; person: 'man' | 'woman' | 'neutral' }> = [];
    const autoPlacedTiles: Array<{ row: number; col: number }> = [];
    
    for (const { row, col, tile } of eligibleTiles) {
      const key = `${row}-${col}`;
      if (manuallyPlacedPeople.has(key) && tile.occupied && tile.person) {
        // This is a manually placed person - preserve it
        manuallyPlaced.push({ row, col, person: tile.person as 'man' | 'woman' | 'neutral' });
      } else {
        // This is an automatically placed tile (or empty) - can be adjusted
        autoPlacedTiles.push({ row, col });
      }
    }
    
    // Count manually placed men and women
    const manuallyPlacedMen = manuallyPlaced.filter(p => p.person === 'man').length;
    const manuallyPlacedWomen = manuallyPlaced.filter(p => p.person === 'woman').length;
    
    // Calculate distribution for remaining auto-placed people
    // Normalize percentages so men + women = 100% of auto-placed tiles
    const totalGenderPct = menPct + womenPct;
    const normalizedMenPct = totalGenderPct > 0 ? (menPct / totalGenderPct) * 100 : 50;
    
    const targetMenCount = Math.round((targetOccupied * normalizedMenPct) / 100);
    const targetWomenCount = targetOccupied - targetMenCount;
    
    // How many more men/women do we need?
    const neededMen = Math.max(0, targetMenCount - manuallyPlacedMen);
    const neededWomen = Math.max(0, targetWomenCount - manuallyPlacedWomen);
    const neededTotal = neededMen + neededWomen;
    
    // Shuffle auto-placed tiles
    const shuffled = [...autoPlacedTiles];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Create new tiles array, starting with current state
    const newTiles = grid.tiles.map((r) =>
      r.map((t) => ({ ...t }))
    );

    // First, preserve all manually placed people
    for (const { row, col, person } of manuallyPlaced) {
      newTiles[row][col].occupied = true;
      newTiles[row][col].person = person;
    }
    
    // Then, place remaining people on auto-placed tiles
    let autoPlaced = 0;
    let menPlaced = 0;
    let womenPlaced = 0;
    
    for (const { row, col } of shuffled) {
      // Skip if this tile is manually placed
      const key = `${row}-${col}`;
      if (manuallyPlacedPeople.has(key)) {
        continue;
      }
      
      if (autoPlaced >= neededTotal) {
        // Clear remaining auto-placed tiles
        newTiles[row][col].occupied = false;
        newTiles[row][col].person = undefined;
      } else {
        // Place men/women on auto-placed tiles
        newTiles[row][col].occupied = true;
        if (menPlaced < neededMen) {
          newTiles[row][col].person = 'man';
          menPlaced++;
        } else if (womenPlaced < neededWomen) {
          newTiles[row][col].person = 'woman';
          womenPlaced++;
        } else {
          // Shouldn't happen, but clear just in case
          newTiles[row][col].occupied = false;
          newTiles[row][col].person = undefined;
        }
        autoPlaced++;
      }
    }

    isUpdatingFromSlider.current = true;
    setGrid(new SubwayGrid(grid.height, grid.width, newTiles));
    setTimeout(() => {
      isUpdatingFromSlider.current = false;
    }, 0);
  }, [grid, calculateGridStats, manuallyPlacedPeople]);

  // Fill grid with default capacity on initial load
  useEffect(() => {
    if (!grid || isUpdatingFromSlider.current) return;
    
    const stats = calculateGridStats(grid);
    // If grid is empty and has eligible tiles, fill it with default capacity
    if (stats.occupied === 0 && stats.totalEligible > 0 && capacity > 0 && isInitialMount.current) {
      isInitialMount.current = false;
      fillGridByCapacity(capacity, menPercentage, womenPercentage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  // Update sliders when grid changes (from manual edits)
  useEffect(() => {
    if (!grid || isUpdatingFromSlider.current) return;

    const stats = calculateGridStats(grid);
    
    // On initial mount, if grid is empty, don't override default slider values
    if (isInitialMount.current && stats.occupied === 0) {
      return; // Keep default slider values, don't update them
    }
    
    // Only update sliders if grid has people (from manual edits)
    if (stats.occupied > 0) {
      setCapacity(stats.capacityPercent);
      setMenPercentage(stats.menPercent);
      setWomenPercentage(stats.womenPercent);
    }
  }, [grid, calculateGridStats]);

  const handleDragStart = useCallback((row: number, col: number, e: React.DragEvent) => {
    if (!grid) return;
    
    const tile = grid.getTile(row, col);
    if (!tile || !tile.occupied || !tile.person) return;
    
    // Store the source tile info in the drag event
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ row, col, person: tile.person }));
  }, [grid]);

  // Handle drag start from tile selector
  const handleSelectorDragStart = useCallback((tileType: 'seat' | 'floor' | 'stanchion' | 'barrier' | 'man' | 'woman' | 'neutral' | 'eraser', e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', JSON.stringify({ fromSelector: true, tileType }));
  }, []);

  const handleDragOver = useCallback((row: number, col: number, e: React.DragEvent) => {
    if (!grid) return;
    
    const tile = grid.getTile(row, col);
    if (!tile) return;
    
    // Check effectAllowed to determine drag source
    // 'copy' means from selector, 'move' means from grid
    const effectAllowed = e.dataTransfer.effectAllowed;
    
    if (effectAllowed === 'copy') {
      // Drag from tile selector - allow drop on all tiles
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    } else if (effectAllowed === 'move') {
      // Drag from grid - only allow on eligible tiles (not barriers)
      if (tile.type !== 'barrier' && !tile.isDoor && !tile.isStanchion) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      }
    }
  }, [grid]);

  const handleDrop = useCallback((row: number, col: number, e: React.DragEvent) => {
    if (!grid) return;
    
    e.preventDefault();
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      
      // Check if this is a drag from the tile selector
      if (dragData.fromSelector === true) {
        const tileType = dragData.tileType;
        const targetTile = grid.getTile(row, col);
        if (!targetTile) return;
        
        // Handle eraser
        if (tileType === 'eraser') {
          const newTiles = grid.tiles.map((r, rIdx) =>
            r.map((t, cIdx) => {
              if (rIdx === row && cIdx === col) {
                const newTile: Tile = { ...t };
                if (t.occupied && t.person) {
                  newTile.occupied = false;
                  newTile.person = undefined;
                  const key = `${row}-${col}`;
                  setManuallyPlacedPeople(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(key);
                    return newSet;
                  });
                } else {
                  newTile.type = 'floor';
                  newTile.isDoor = false;
                  newTile.isStanchion = false;
                }
                return newTile;
              }
              return t;
            })
          );
          setGrid(new SubwayGrid(grid.height, grid.width, newTiles));
          return;
        }
        
        // Handle person types
        if (tileType === 'man' || tileType === 'woman' || tileType === 'neutral') {
          if (targetTile.type === 'barrier') return;
          
          const newTiles = grid.tiles.map((r, rIdx) =>
            r.map((t, cIdx) => {
              if (rIdx === row && cIdx === col) {
                const newTile: Tile = { ...t };
                if (t.occupied && t.person === tileType) {
                  newTile.occupied = false;
                  newTile.person = undefined;
                  const key = `${row}-${col}`;
                  setManuallyPlacedPeople(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(key);
                    return newSet;
                  });
                } else {
                  newTile.occupied = true;
                  newTile.person = tileType;
                  const key = `${row}-${col}`;
                  setManuallyPlacedPeople(prev => {
                    const newSet = new Set(prev);
                    newSet.add(key);
                    return newSet;
                  });
                }
                return newTile;
              }
              return t;
            })
          );
          setGrid(new SubwayGrid(grid.height, grid.width, newTiles));
          return;
        }
        
        // Handle tile types (seat, floor, stanchion, barrier)
        if (tileType === 'seat' || tileType === 'floor' || tileType === 'stanchion' || tileType === 'barrier') {
          const newTiles = grid.tiles.map((r, rIdx) =>
            r.map((t, cIdx) => {
              if (rIdx === row && cIdx === col) {
                const newTile: Tile = { ...t };
                newTile.type = tileType;
                if (tileType === 'floor') {
                  newTile.isDoor = false;
                  newTile.isStanchion = false;
                } else if (tileType === 'stanchion') {
                  newTile.isStanchion = true;
                  newTile.isDoor = false;
                } else {
                  newTile.isDoor = false;
                  newTile.isStanchion = false;
                }
                // Clear person if placing a barrier
                if (tileType === 'barrier') {
                  newTile.occupied = false;
                  newTile.person = undefined;
                  const key = `${row}-${col}`;
                  setManuallyPlacedPeople(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(key);
                    return newSet;
                  });
                }
                return newTile;
              }
              return t;
            })
          );
          setGrid(new SubwayGrid(grid.height, grid.width, newTiles));
          return;
        }
        
        return;
      }
      
      // Handle grid-to-grid drag (existing logic)
      const sourceRow = dragData.row;
      const sourceCol = dragData.col;
      const personType = dragData.person;
      
      // Don't do anything if dropping on the same tile
      if (sourceRow === row && sourceCol === col) return;
      
      const targetTile = grid.getTile(row, col);
      if (!targetTile || targetTile.type === 'barrier') return;
      
      // If target already has a person, swap them
      const targetPerson = targetTile.occupied && targetTile.person ? targetTile.person : null;
      
      const newTiles = grid.tiles.map((r, rIdx) =>
        r.map((t, cIdx) => {
          if (rIdx === sourceRow && cIdx === sourceCol) {
            // Source tile: if swapping, place target person here, otherwise clear
            if (targetPerson) {
              return { ...t, occupied: true, person: targetPerson };
            } else {
              return { ...t, occupied: false, person: undefined };
            }
          } else if (rIdx === row && cIdx === col) {
            // Target tile: place dragged person here
            return { ...t, occupied: true, person: personType };
          }
          return t;
        })
      );
      
      // Mark both source and target as manually placed
      setManuallyPlacedPeople(prev => {
        const newSet = new Set(prev);
        const sourceKey = `${sourceRow}-${sourceCol}`;
        const targetKey = `${row}-${col}`;
        
        // If swapping, both tiles are manually placed
        if (targetPerson) {
          newSet.add(sourceKey);
          newSet.add(targetKey);
        } else {
          // Moving: source is cleared (remove from manual), target is manually placed
          newSet.delete(sourceKey);
          newSet.add(targetKey);
        }
        
        return newSet;
      });
      
      setGrid(new SubwayGrid(grid.height, grid.width, newTiles));
    } catch (err) {
      // Invalid drag data, ignore
      console.error('Invalid drag data:', err);
    }
  }, [grid]);

  const handleTileClick = useCallback((row: number, col: number) => {
    if (!grid) return;

    const tile = grid.getTile(row, col);
    if (!tile) return;

    // Handle eraser mode
    if (selectedMode === 'eraser') {
      const newTiles = grid.tiles.map((r, rIdx) =>
        r.map((t, cIdx) => {
          if (rIdx === row && cIdx === col) {
            const newTile: Tile = { ...t };
            
            // If there's a person, remove it
            if (t.occupied && t.person) {
              newTile.occupied = false;
              newTile.person = undefined;
              
              // Remove from manually placed tracking
              const key = `${row}-${col}`;
              setManuallyPlacedPeople(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
              });
            } else {
              // Otherwise, place a floor tile
              newTile.type = 'floor';
              newTile.isDoor = false;
              newTile.isStanchion = false;
            }
            
            return newTile;
          }
          return t;
        })
      );
      
      setGrid(new SubwayGrid(grid.height, grid.width, newTiles));
      return;
    }

    // Check if a person type is selected
    if (selectedMode === 'man' || selectedMode === 'woman' || selectedMode === 'neutral') {
      // Can only place people on seats and floor (not barriers)
      if (tile.type === 'barrier') return;

      const newTiles = grid.tiles.map((r, rIdx) =>
        r.map((t, cIdx) => {
          if (rIdx === row && cIdx === col) {
            const newTile: Tile = { ...t };
            
            // If clicking on a tile with the same person type, remove it
            // Otherwise, place the selected person type
            if (t.occupied && t.person === selectedMode) {
              newTile.occupied = false;
              newTile.person = undefined;
            } else {
              newTile.occupied = true;
              newTile.person = selectedMode;
            }

            return newTile;
          }
          return t;
        })
      );

      // Mark as manually placed if adding, remove if removing
      const key = `${row}-${col}`;
      setManuallyPlacedPeople(prev => {
        const newSet = new Set(prev);
        if (tile.occupied && tile.person === selectedMode) {
          // Removing - unmark as manually placed
          newSet.delete(key);
        } else {
          // Adding - mark as manually placed
          newSet.add(key);
        }
        return newSet;
      });

      setGrid(new SubwayGrid(grid.height, grid.width, newTiles));
      return;
    }

    // Otherwise, place the selected tile type
    const newTiles = grid.tiles.map((r, rIdx) =>
      r.map((t, cIdx) => {
        if (rIdx === row && cIdx === col) {
          const newTile: Tile = { ...t };
          
          // Place the selected tile type
          if (selectedMode === 'stanchion') {
            // Stanchions are floor tiles with isStanchion: true
            newTile.type = 'floor';
            newTile.isStanchion = true;
            newTile.isDoor = false;
            newTile.occupied = false;
            newTile.person = undefined;
          } else {
            newTile.type = selectedMode;
            
            // Clear door and stanchion when changing to seat or barrier
            if (newTile.type === 'seat') {
              newTile.isDoor = false;
              newTile.isStanchion = false;
              // Don't clear occupied/person when changing to seat - allow keeping people
            } else if (newTile.type === 'barrier') {
              // Barriers are not interactive, clear all flags
              newTile.isDoor = false;
              newTile.isStanchion = false;
              newTile.occupied = false;
              newTile.person = undefined;
            } else {
              // When placing floor, clear stanchion/door flags but keep person if it exists
              newTile.isStanchion = false;
              newTile.isDoor = false;
            }
          }

          return newTile;
        }
        return t;
      })
    );

    setGrid(new SubwayGrid(grid.height, grid.width, newTiles));
  }, [grid, selectedMode]);

  const handleSave = async () => {
    if (!grid) {
      setError('No grid to save');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Check if we're editing an existing scenario
      const scenarioId = id ? parseInt(id, 10) : (savedConfig?.id);
      
      let config: TrainConfigurationResponse;
      if (scenarioId && !isNaN(scenarioId)) {
        // Update existing scenario
        config = await trainConfigApi.update(scenarioId, {
        name: name || undefined,
          title: title || undefined,
        height: grid.height,
        width: grid.width,
        tiles: grid.tiles,
      });
      } else {
        // Create new scenario
        config = await trainConfigApi.create({
          name: name || undefined,
          title: title || undefined,
          height: grid.height,
          width: grid.width,
          tiles: grid.tiles,
        });
      }

      setSavedConfig(config);
      // updated_at will be in the config response, which will update the "Last saved" indicator
      // Show temporary save banner
      setShowSaveBanner(true);
      setTimeout(() => {
        setShowSaveBanner(false);
      }, 3000); // Hide after 3 seconds
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scenario');
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (scenarioId: number) => {
    try {
      const config = await trainConfigApi.getById(scenarioId);
      setGrid(new SubwayGrid(config.height, config.width, config.tiles));
      setName(config.name || '');
      setTitle(config.title || '');
      setSavedConfig(config);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario');
    }
  };

  // Debounced update function for title
  const debouncedUpdateTitle = useCallback(async (newTitle: string) => {
    // Only save if we have a saved config (scenario exists in DB)
    if (!savedConfig?.id) return;

    setSavingTitle(true);
    try {
      const scenarioId = savedConfig.id;
      const updatedConfig = await trainConfigApi.update(scenarioId, {
        name: name || undefined,
        title: newTitle || undefined,
        height: grid!.height,
        width: grid!.width,
        tiles: grid!.tiles,
      });
      setSavedConfig(updatedConfig);
      // Update local state to match server response
      setTitle(updatedConfig.title || '');
      // updated_at will be updated in savedConfig, which will trigger re-render
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update title');
    } finally {
      setSavingTitle(false);
    }
  }, [savedConfig, name, grid]);

  // Handle title change with debouncing
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    // Clear existing timer
    if (titleDebounceTimerRef.current) {
      clearTimeout(titleDebounceTimerRef.current);
    }

    // Only debounce if we have a saved config (scenario exists in DB)
    if (savedConfig?.id) {
      // Set new timer
      titleDebounceTimerRef.current = setTimeout(() => {
        debouncedUpdateTitle(newTitle);
      }, 500); // 500ms debounce
                }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceTimerRef.current) {
        clearTimeout(titleDebounceTimerRef.current);
      }
    };
  }, []);

  // Load scenario if ID is provided in route (but not if initialGrid is provided)
  useEffect(() => {
    if (id && !initialGrid) {
      const scenarioId = parseInt(id, 10);
      if (!isNaN(scenarioId)) {
        handleLoad(scenarioId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, initialGrid]);

  return (
    <div className="scenario-editor">
      {/* Back button if coming from study detail */}
      {studyId && (
            <button
          onClick={() => navigate(`/study-builder/${studyId}`)} 
          className="scenario-editor-back-button"
            >
          ← Back to Study
            </button>
      )}
      {/* <div className="scenario-editor-header">
        <h1>Scenario Editor</h1>
        <p>Create and share subway train configurations</p>
      </div> */}



      {grid ? (
        <div className={`scenario-editor-grid-wrapper ${showSaveBanner ? 'has-banner' : ''}`}>
          {/* Title input */}
          <div className="scenario-title-section">
            {(savingTitle || savedConfig?.updated_at) && (
              <div className="last-saved-indicator">
                {savingTitle ? (
                  'Saving...'
                ) : savedConfig?.updated_at ? (
                  `Last saved ${formatRelativeTime(savedConfig.updated_at)}`
                ) : null}
              </div>
            )}
            <div className="scenario-title-header">
          <input
            type="text"
                value={title}
                onChange={handleTitleChange}
                className="scenario-title-input"
                placeholder="Scenario title (optional)"
              />
              {savingTitle && <span className="saving-indicator">Saving...</span>}
            </div>
        </div>

          {/* Temporary save banner */}
          {showSaveBanner && savedConfig && (
            <div className="save-success-banner">
              <div className="save-success-content">
                <span className="save-success-message">
                  ✓ Scenario {savedConfig.id} saved!
                </span>
          <button
                  className="close-banner-button"
                  onClick={() => setShowSaveBanner(false)}
                  aria-label="Close banner"
          >
                  ×
          </button>
        </div>
          </div>
        )}

          {/* Permanent links for existing scenarios */}
          {savedConfig && (
            <div className="scenario-links-section">
              <a 
                href={`/scenario/${savedConfig.id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="scenario-link-plain"
              >
                View Scenario
              </a>
              <button
                className="copy-link-button-plain"
                onClick={() => {
                  const url = `${window.location.origin}/scenario/${savedConfig.id}`;
                  navigator.clipboard.writeText(url).then(() => {
                    setLinkCopied(true);
                    setTimeout(() => {
                      setLinkCopied(false);
                    }, 2000);
                  }).catch(() => {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = url;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    setLinkCopied(true);
                    setTimeout(() => {
                      setLinkCopied(false);
                    }, 2000);
                  });
                }}
              >
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
          </div>
        )}
          <div className="tile-selector-header">
            <div className="tile-selector-label">Add:</div>
            <div className="tile-selector-tiles">
              <div
                className={`tile-selector-item ${selectedMode === 'man' ? 'active' : ''}`}
                onClick={() => setSelectedMode('man')}
                draggable
                onDragStart={(e) => handleSelectorDragStart('man', e)}
              >
                <div className="tile-selector-preview person-preview">
                  <span className="person-emoji-preview">👨</span>
                </div>
                <span>Man</span>
              </div>
              <div
                className={`tile-selector-item ${selectedMode === 'woman' ? 'active' : ''}`}
                onClick={() => setSelectedMode('woman')}
                draggable
                onDragStart={(e) => handleSelectorDragStart('woman', e)}
              >
                <div className="tile-selector-preview person-preview">
                  <span className="person-emoji-preview">👩</span>
                </div>
                <span>Woman</span>
              </div>
              <div
                className={`tile-selector-item ${selectedMode === 'neutral' ? 'active' : ''}`}
                onClick={() => setSelectedMode('neutral')}
                draggable
                onDragStart={(e) => handleSelectorDragStart('neutral', e)}
              >
                <div className="tile-selector-preview person-preview">
                  <span className="person-emoji-preview">🧑</span>
                </div>
                <span>Person</span>
              </div>
              <div
                className={`tile-selector-item ${selectedMode === 'seat' ? 'active' : ''}`}
                onClick={() => setSelectedMode('seat')}
                draggable
                onDragStart={(e) => handleSelectorDragStart('seat', e)}
              >
                <div className="tile-selector-preview tile-seat-preview"></div>
                <span>Seat</span>
              </div>
              <div
                className={`tile-selector-item ${selectedMode === 'floor' ? 'active' : ''}`}
                onClick={() => setSelectedMode('floor')}
                draggable
                onDragStart={(e) => handleSelectorDragStart('floor', e)}
              >
                <div className="tile-selector-preview tile-floor-preview"></div>
                <span>Floor</span>
              </div>
              <div
                className={`tile-selector-item ${selectedMode === 'stanchion' ? 'active' : ''}`}
                onClick={() => setSelectedMode('stanchion')}
                draggable
                onDragStart={(e) => handleSelectorDragStart('stanchion', e)}
              >
                <div className="tile-selector-preview tile-stanchion-preview"></div>
                <span>Stanchion</span>
              </div>
              <div
                className={`tile-selector-item ${selectedMode === 'barrier' ? 'active' : ''}`}
                onClick={() => setSelectedMode('barrier')}
                draggable
                onDragStart={(e) => handleSelectorDragStart('barrier', e)}
              >
                <div className="tile-selector-preview tile-barrier-preview"></div>
                <span>Barrier</span>
              </div>
              <div
                className={`tile-selector-item ${selectedMode === 'eraser' ? 'active' : ''}`}
                onClick={() => setSelectedMode('eraser')}
                draggable
                onDragStart={(e) => handleSelectorDragStart('eraser', e)}
              >
                <div className="tile-selector-preview eraser-preview">
                  <span className="eraser-icon">❌</span>
                </div>
                <span>Eraser</span>
              </div>
            </div>
            <div className="tile-selector-header-actions">
              <button
                className="header-save-button"
                onClick={handleSave}
                disabled={!grid || saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          <div className="capacity-controls-header">
            <div className="capacity-control-group">
              <label htmlFor="capacity-slider">Capacity: {capacity}%</label>
              <input
                id="capacity-slider"
                type="range"
                min="0"
                max="100"
                value={capacity}
                onChange={(e) => {
                  const newCapacity = parseInt(e.target.value);
                  setCapacity(newCapacity);
                  // Constrain women percentage if needed
                  const maxWomen = 100 - menPercentage;
                  const adjustedWomen = Math.min(womenPercentage, maxWomen);
                  fillGridByCapacity(newCapacity, menPercentage, adjustedWomen);
                }}
                className="capacity-slider"
              />
            </div>
            <div className="capacity-control-group">
              <label htmlFor="men-slider">Men: {menPercentage}%</label>
              <input
                id="men-slider"
                type="range"
                min="0"
                max="100"
                value={menPercentage}
                onChange={(e) => {
                  const newMenPct = parseInt(e.target.value);
                  // Always adjust women to keep total at 100%
                  const adjustedWomen = 100 - newMenPct;
                  setMenPercentage(newMenPct);
                  setWomenPercentage(adjustedWomen);
                  fillGridByCapacity(capacity, newMenPct, adjustedWomen);
                }}
                className="capacity-slider"
                disabled={capacity === 0}
              />
            </div>
            <div className="capacity-control-group">
              <label htmlFor="women-slider">Women: {womenPercentage}%</label>
              <input
                id="women-slider"
                type="range"
                min="0"
                max="100"
                value={womenPercentage}
                onChange={(e) => {
                  const newWomenPct = parseInt(e.target.value);
                  // Always adjust men to keep total at 100%
                  const adjustedMen = 100 - newWomenPct;
                  setMenPercentage(adjustedMen);
                  setWomenPercentage(newWomenPct);
                  fillGridByCapacity(capacity, adjustedMen, newWomenPct);
                }}
                className="capacity-slider"
                disabled={capacity === 0}
              />
            </div>
          </div>
          <div className="scenario-editor-grid">
            <Grid
              grid={grid}
              onTileClick={handleTileClick}
              selectedTile={null}
              playerGender="neutral"
              doorsOpen={true}
              animationState="idle"
              editMode={true}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </div>
        </div>
      ) : (
        <div className="no-grid-message">
          <p>Set grid dimensions above and click outside the inputs to create a grid.</p>
        </div>
      )}
    </div>
  );
}

