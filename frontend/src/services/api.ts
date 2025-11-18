import { Tile } from '../types/grid';

// Use /api prefix which is proxied to the backend by Vite
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface TrainConfigurationCreate {
  name?: string;
  height: number;
  width: number;
  tiles: Tile[][];
}

export interface TrainConfigurationResponse {
  id: number;
  name?: string;
  height: number;
  width: number;
  tiles: Tile[][];
  created_at: string;
  updated_at?: string;
}

export interface UserResponseCreate {
  train_configuration_id: number;
  row: number;
  col: number;
  selection_type: 'seat' | 'floor';
  user_session_id?: string;
  user_id?: string;
  gender?: 'man' | 'woman' | 'neutral';
}

export interface UserResponseResponse {
  id: number;
  train_configuration_id: number;
  row: number;
  col: number;
  selection_type: string;
  user_session_id?: string;
  user_id?: string;
  created_at: string;
}

// Train Configuration API
export const trainConfigApi = {
  async create(config: TrainConfigurationCreate): Promise<TrainConfigurationResponse> {
    const response = await fetch(`${API_BASE_URL}/train-configurations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create train configuration' }));
      throw new Error(error.detail || 'Failed to create train configuration');
    }

    return response.json();
  },

  async getAll(skip = 0, limit = 100): Promise<TrainConfigurationResponse[]> {
    const response = await fetch(`${API_BASE_URL}/train-configurations?skip=${skip}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch train configurations');
    }

    return response.json();
  },

  async getById(id: number): Promise<TrainConfigurationResponse> {
    const response = await fetch(`${API_BASE_URL}/train-configurations/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Train configuration not found');
      }
      throw new Error('Failed to fetch train configuration');
    }

    return response.json();
  },

  async getRandom(): Promise<TrainConfigurationResponse> {
    const response = await fetch(`${API_BASE_URL}/train-configurations/random`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No train configurations found');
      }
      throw new Error('Failed to fetch random train configuration');
    }

    return response.json();
  },

  async getStatistics(id: number, gender?: 'man' | 'woman' | 'neutral') {
    const params = new URLSearchParams();
    if (gender) {
      params.append('gender', gender);
    }
    const url = `${API_BASE_URL}/train-configurations/${id}/statistics${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch statistics');
    }

    return response.json();
  },
};

// User Response API
export const userResponseApi = {
  async create(response: UserResponseCreate): Promise<UserResponseResponse> {
    const url = `${API_BASE_URL}/user-responses`;
    console.log('Making POST request to:', url);
    console.log('Request body:', JSON.stringify(response, null, 2));
    
    try {
      const result = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(response),
      });

      console.log('Response status:', result.status, result.statusText);
      console.log('Response headers:', Object.fromEntries(result.headers.entries()));

      if (!result.ok) {
        const errorText = await result.text();
        console.error('Error response body:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { detail: errorText || 'Failed to create user response' };
        }
        throw new Error(error.detail || `HTTP ${result.status}: ${result.statusText}`);
      }

      const responseData = await result.json();
      console.log('Response data:', responseData);
      return responseData;
    } catch (err) {
      console.error('Fetch error:', err);
      throw err;
    }
  },

  async getAll(filters?: {
    train_configuration_id?: number;
    user_session_id?: string;
    user_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<UserResponseResponse[]> {
    const params = new URLSearchParams();
    if (filters?.train_configuration_id) {
      params.append('train_configuration_id', filters.train_configuration_id.toString());
    }
    if (filters?.user_session_id) {
      params.append('user_session_id', filters.user_session_id);
    }
    if (filters?.user_id) {
      params.append('user_id', filters.user_id);
    }
    if (filters?.skip) {
      params.append('skip', filters.skip.toString());
    }
    if (filters?.limit) {
      params.append('limit', filters.limit.toString());
    }

    const response = await fetch(`${API_BASE_URL}/user-responses?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch user responses');
    }

    return response.json();
  },

  async getById(id: number): Promise<UserResponseResponse> {
    const response = await fetch(`${API_BASE_URL}/user-responses/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User response not found');
      }
      throw new Error('Failed to fetch user response');
    }

    return response.json();
  },

  /**
   * Get the user's previous response for a specific scenario and session
   * Returns the most recent response if multiple exist
   */
  async getPreviousResponse(
    train_configuration_id: number,
    user_session_id: string
  ): Promise<UserResponseResponse | null> {
    const responses = await this.getAll({
      train_configuration_id,
      user_session_id,
      limit: 1,
    });
    
    return responses.length > 0 ? responses[0] : null;
  },
};

