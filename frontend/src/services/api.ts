import { Tile } from '../types/grid';

// Use /api prefix which is proxied to the backend by Vite
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Helper function for fetch with credentials
const fetchWithCredentials = async (url: string, options: RequestInit = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include', // Include cookies in all requests
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
};

export interface TrainConfigurationCreate {
  name?: string;
  title?: string;
  height: number;
  width: number;
  tiles: Tile[][];
}

export interface TrainConfigurationResponse {
  id: number;
  name?: string;
  title?: string;
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
  gender?: 'man' | 'woman' | 'neutral' | 'prefer-not-to-say';
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
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations`, {
      method: 'POST',
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create train configuration' }));
      throw new Error(error.detail || 'Failed to create train configuration');
    }

    return response.json();
  },

  async getAll(skip = 0, limit = 100): Promise<TrainConfigurationResponse[]> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations?skip=${skip}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch train configurations');
    }

    return response.json();
  },

  async getById(id: number): Promise<TrainConfigurationResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Train configuration not found');
      }
      throw new Error('Failed to fetch train configuration');
    }

    return response.json();
  },

  async getRandom(): Promise<TrainConfigurationResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations/random`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No train configurations found');
      }
      throw new Error('Failed to fetch random train configuration');
    }

    return response.json();
  },

  async getStatistics(id: number, gender?: 'man' | 'woman' | 'neutral' | 'prefer-not-to-say') {
    const params = new URLSearchParams();
    if (gender) {
      params.append('gender', gender);
    }
    const url = `${API_BASE_URL}/train-configurations/${id}/statistics${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetchWithCredentials(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch statistics');
    }

    return response.json();
  },

  async update(id: number, config: TrainConfigurationCreate): Promise<TrainConfigurationResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update train configuration' }));
      throw new Error(error.detail || 'Failed to update train configuration');
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
      const result = await fetchWithCredentials(url, {
        method: 'POST',
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

    const response = await fetchWithCredentials(`${API_BASE_URL}/user-responses?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch user responses');
    }

    return response.json();
  },

  async getById(id: number): Promise<UserResponseResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/user-responses/${id}`);
    
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

// Authentication API
export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  message: string;
}

export const authApi = {
  async sendVerification(email: string, verificationType: 'magic_link' | 'token' | 'both'): Promise<{ message: string }> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/auth/send-verification`, {
      method: 'POST',
      body: JSON.stringify({ email, verification_type: verificationType }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to send verification email' }));
      throw new Error(error.detail || 'Failed to send verification email');
    }

    return response.json();
  },

  async verifyLink(token: string): Promise<AuthResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/auth/verify-link?token=${encodeURIComponent(token)}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to verify link' }));
      throw new Error(error.detail || 'Failed to verify link');
    }

    return response.json();
  },

  async verifyToken(email: string, verificationCode: string): Promise<AuthResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/auth/verify-token`, {
      method: 'POST',
      body: JSON.stringify({ email, verification_code: verificationCode }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to verify token' }));
      throw new Error(error.detail || 'Failed to verify token');
    }

    return response.json();
  },

  async logout(): Promise<{ message: string }> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to logout');
    }

    return response.json();
  },

  async getCurrentUser(): Promise<User> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/auth/me`);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      throw new Error('Failed to get current user');
    }

    return response.json();
  },
};

// Scenario Group API (minimal - just for creating empty groups)
export interface ScenarioGroupCreate {
  items?: Array<{ train_configuration_id: number; order: number }>;
}

export interface ScenarioGroupResponse {
  id: number;
  created_by_user_id: number;
  created_at: string;
  updated_at?: string;
  items?: any[];
}

export interface ScenarioGroupItemCreate {
  train_configuration_id: number;
  order: number;
}

export interface ScenarioGroupItemResponse {
  id: number;
  scenario_group_id: number;
  train_configuration_id: number;
  order: number;
  created_at: string;
  train_configuration?: TrainConfigurationResponse;
}

export const scenarioGroupApi = {
  async create(group: ScenarioGroupCreate = { items: [] }): Promise<ScenarioGroupResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/scenario-groups`, {
      method: 'POST',
      body: JSON.stringify(group),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create scenario group' }));
      throw new Error(error.detail || 'Failed to create scenario group');
    }

    return response.json();
  },

  async addItem(groupId: number, item: ScenarioGroupItemCreate): Promise<ScenarioGroupItemResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/scenario-groups/${groupId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to add item to scenario group' }));
      throw new Error(error.detail || 'Failed to add item to scenario group');
    }

    return response.json();
  },

  async deleteItem(groupId: number, itemId: number): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/scenario-groups/${groupId}/items/${itemId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete item from scenario group' }));
      throw new Error(error.detail || 'Failed to delete item from scenario group');
    }
  },
};

// Study API
export interface StudyCreate {
  title: string;
  description?: string;
  email: string;
  scenario_group_id: number;
}

export interface StudyUpdate {
  title?: string;
  description?: string;
  email?: string;
  scenario_group_id?: number;
}

export interface StudyResponse {
  id: number;
  title: string;
  description?: string;
  email: string;
  scenario_group_id: number;
  created_by_user_id: number;
  created_at: string;
  updated_at?: string;
  scenario_group?: any; // ScenarioGroupResponse - can be typed more specifically if needed
}

export const studyApi = {
  async create(study: StudyCreate): Promise<StudyResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies`, {
      method: 'POST',
      body: JSON.stringify(study),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create study' }));
      throw new Error(error.detail || 'Failed to create study');
    }

    return response.json();
  },

  async getAll(skip = 0, limit = 100): Promise<StudyResponse[]> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies?skip=${skip}&limit=${limit}`);

    if (!response.ok) {
      throw new Error('Failed to fetch studies');
    }

    return response.json();
  },

  async getById(id: number): Promise<StudyResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${id}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Study not found');
      }
      throw new Error('Failed to fetch study');
    }

    return response.json();
  },

  async update(id: number, study: StudyUpdate): Promise<StudyResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(study),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update study' }));
      throw new Error(error.detail || 'Failed to update study');
    }

    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete study' }));
      throw new Error(error.detail || 'Failed to delete study');
    }
  },
};

