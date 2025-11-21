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

  async getQuestions(configId: number): Promise<PostResponseQuestionResponse[]> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations/${configId}/questions`);

    if (!response.ok) {
      throw new Error('Failed to fetch questions');
    }

    return response.json();
  },

  async getQuestionsForResponse(configId: number): Promise<PostResponseQuestionResponse[]> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations/${configId}/questions-for-response`);

    if (!response.ok) {
      throw new Error('Failed to fetch questions for response');
    }

    return response.json();
  },

  async createQuestion(configId: number, question: PostResponseQuestionCreate): Promise<PostResponseQuestionResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations/${configId}/questions`, {
      method: 'POST',
      body: JSON.stringify(question),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create question' }));
      throw new Error(error.detail || 'Failed to create question');
    }

    return response.json();
  },

  async updateQuestion(configId: number, questionId: number, question: PostResponseQuestionCreate): Promise<PostResponseQuestionResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations/${configId}/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(question),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update question' }));
      throw new Error(error.detail || 'Failed to update question');
    }

    return response.json();
  },

  async deleteQuestion(configId: number, questionId: number): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations/${configId}/questions/${questionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete question' }));
      throw new Error(error.detail || 'Failed to delete question');
    }
  },

  async getTagStatistics(configId: number, questionId: number, row?: number, col?: number): Promise<TagStatisticsResponse[]> {
    const params = new URLSearchParams();
    if (row !== undefined && col !== undefined) {
      params.append('row', row.toString());
      params.append('col', col.toString());
    }
    const url = `${API_BASE_URL}/train-configurations/${configId}/questions/${questionId}/tag-statistics${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetchWithCredentials(url);

    if (!response.ok) {
      throw new Error('Failed to fetch tag statistics');
    }

    return response.json();
  },

  async getQuestionResponses(configId: number): Promise<Record<number, QuestionResponseResponse[]>> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/train-configurations/${configId}/question-responses`);

    if (!response.ok) {
      throw new Error('Failed to fetch question responses');
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

  async submitQuestionResponses(responseId: number, responses: QuestionResponseCreate[]): Promise<QuestionResponseResponse[]> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/user-responses/${responseId}/question-responses`, {
      method: 'POST',
      body: JSON.stringify(responses),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to submit question responses' }));
      throw new Error(error.detail || 'Failed to submit question responses');
    }

    return response.json();
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

  async getPublic(id: number): Promise<StudyResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${id}/public`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Study not found');
      }
      throw new Error('Failed to fetch study');
    }

    return response.json();
  },

  async getScenarioByOrder(studyId: number, scenarioNumber: number): Promise<TrainConfigurationResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/scenario/${scenarioNumber}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Scenario not found');
      }
      throw new Error('Failed to fetch scenario');
    }

    return response.json();
  },
};

// PreStudyQuestion API
export interface PreStudyQuestionCreate {
  question_id?: number;
  question_text?: string;
  allows_free_text?: boolean;
  allows_tags?: boolean;
  allows_multiple_tags?: boolean;
  is_required?: boolean;
  order?: number;
  tag_ids?: number[];
}

export interface PreStudyQuestionResponse {
  id: number;
  question_id: number;
  study_id: number;
  is_required: boolean;
  order: number;
  created_at: string;
  updated_at?: string;
  question: QuestionResponse;
  tags: QuestionTagResponse[];
}

export const preStudyQuestionApi = {
  async create(studyId: number, question: PreStudyQuestionCreate): Promise<PreStudyQuestionResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/pre-study-questions`, {
      method: 'POST',
      body: JSON.stringify(question),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create pre-study question' }));
      throw new Error(error.detail || 'Failed to create pre-study question');
    }

    return response.json();
  },

  async getAll(studyId: number): Promise<PreStudyQuestionResponse[]> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/pre-study-questions`);

    if (!response.ok) {
      throw new Error('Failed to fetch pre-study questions');
    }

    return response.json();
  },

  async update(studyId: number, questionId: number, question: PreStudyQuestionCreate): Promise<PreStudyQuestionResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/pre-study-questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(question),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update pre-study question' }));
      throw new Error(error.detail || 'Failed to update pre-study question');
    }

    return response.json();
  },

  async delete(studyId: number, questionId: number): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/pre-study-questions/${questionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete pre-study question' }));
      throw new Error(error.detail || 'Failed to delete pre-study question');
    }
  },
};

// PostStudyQuestion API
export interface PostStudyQuestionCreate {
  question_id?: number;
  question_text?: string;
  allows_free_text?: boolean;
  allows_tags?: boolean;
  allows_multiple_tags?: boolean;
  is_required?: boolean;
  order?: number;
  tag_ids?: number[];
}

export interface PostStudyQuestionResponse {
  id: number;
  question_id: number;
  study_id: number;
  is_required: boolean;
  order: number;
  created_at: string;
  updated_at?: string;
  question: QuestionResponse;
  tags: QuestionTagResponse[];
}

export const postStudyQuestionApi = {
  async create(studyId: number, question: PostStudyQuestionCreate): Promise<PostStudyQuestionResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/post-study-questions`, {
      method: 'POST',
      body: JSON.stringify(question),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create post-study question' }));
      throw new Error(error.detail || 'Failed to create post-study question');
    }

    return response.json();
  },

  async getAll(studyId: number): Promise<PostStudyQuestionResponse[]> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/post-study-questions`);

    if (!response.ok) {
      throw new Error('Failed to fetch post-study questions');
    }

    return response.json();
  },

  async update(studyId: number, questionId: number, question: PostStudyQuestionCreate): Promise<PostStudyQuestionResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/post-study-questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(question),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update post-study question' }));
      throw new Error(error.detail || 'Failed to update post-study question');
    }

    return response.json();
  },

  async delete(studyId: number, questionId: number): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/post-study-questions/${questionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete post-study question' }));
      throw new Error(error.detail || 'Failed to delete post-study question');
    }
  },
};

// Question API
export interface QuestionTagResponse {
  id: number;
  tag_text: string;
  is_default: boolean;
  created_by_user_id?: number;
  created_at: string;
}

export interface PostResponseQuestionResponse {
  id: number;
  question_id: number;
  train_configuration_id: number;
  is_required: boolean;
  free_text_required: boolean;
  order: number;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
  question: {
    id: number;
    question_text: string;
    allows_free_text: boolean;
    allows_tags: boolean;
    allows_multiple_tags: boolean;
    created_at: string;
    updated_at?: string;
  };
  tags: QuestionTagResponse[];
}

export interface PostResponseQuestionCreate {
  question_id?: number;
  question_text?: string;
  is_required?: boolean;
  free_text_required?: boolean;
  allows_free_text?: boolean;
  allows_tags?: boolean;
  allows_multiple_tags?: boolean;
  order?: number;
  tag_ids?: number[];
}

export interface QuestionTagCreate {
  tag_text: string;
  is_default?: boolean;
}

export interface QuestionResponseCreate {
  post_response_question_id: number;
  free_text_response?: string;
  selected_tag_ids?: number[];
}

export interface QuestionResponseResponse {
  id: number;
  user_response_id: number;
  post_response_question_id: number;
  free_text_response?: string;
  created_at: string;
  selected_tags: QuestionTagResponse[];
}

export interface TagStatisticsResponse {
  tag_id: number;
  tag_text: string;
  selection_count: number;
}

export interface TagLibraryResponse {
  default_tags: QuestionTagResponse[];
  your_tags: QuestionTagResponse[];
  community_tags: QuestionTagResponse[];
}

export const questionApi = {
  async getTagLibrary(): Promise<TagLibraryResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/questions/tag-library`);

    if (!response.ok) {
      throw new Error('Failed to fetch tag library');
    }

    return response.json();
  },

  async createTag(tag: QuestionTagCreate): Promise<QuestionTagResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}/questions/tags`, {
      method: 'POST',
      body: JSON.stringify(tag),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create tag' }));
      throw new Error(error.detail || 'Failed to create tag');
    }

    return response.json();
  },
};

// Pre-Study Question Response API
export interface PreStudyQuestionResponseCreate {
  pre_study_question_id: number;
  free_text_response?: string;
  selected_tag_ids?: number[];
}

export interface PreStudyQuestionAnswerResponse {
  id: number;
  pre_study_question_id: number;
  user_session_id: string;
  user_id?: string;
  free_text_response?: string;
  created_at: string;
  selected_tags: QuestionTagResponse[];
}

export const preStudyQuestionResponseApi = {
  async create(studyId: number, responses: PreStudyQuestionResponseCreate[], sessionId: string, userId?: string): Promise<PreStudyQuestionAnswerResponse[]> {
    const params = new URLSearchParams();
    params.append('user_session_id', sessionId);
    if (userId) {
      params.append('user_id', userId);
    }
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/pre-study-question-responses?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(responses),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to submit pre-study question responses' }));
      throw new Error(error.detail || 'Failed to submit pre-study question responses');
    }

    return response.json();
  },

  async getBySession(studyId: number, sessionId: string): Promise<PreStudyQuestionAnswerResponse[]> {
    const params = new URLSearchParams();
    params.append('user_session_id', sessionId);
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/pre-study-question-responses?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Failed to fetch pre-study question responses');
    }

    return response.json();
  },
};

// Post-Study Question Response API
export interface PostStudyQuestionResponseCreate {
  post_study_question_id: number;
  free_text_response?: string;
  selected_tag_ids?: number[];
}

export interface PostStudyQuestionAnswerResponse {
  id: number;
  post_study_question_id: number;
  user_session_id: string;
  user_id?: string;
  free_text_response?: string;
  created_at: string;
  selected_tags: QuestionTagResponse[];
}

export const postStudyQuestionResponseApi = {
  async create(studyId: number, responses: PostStudyQuestionResponseCreate[], sessionId: string, userId?: string): Promise<PostStudyQuestionAnswerResponse[]> {
    const params = new URLSearchParams();
    params.append('user_session_id', sessionId);
    if (userId) {
      params.append('user_id', userId);
    }
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/post-study-question-responses?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(responses),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to submit post-study question responses' }));
      throw new Error(error.detail || 'Failed to submit post-study question responses');
    }

    return response.json();
  },

  async getBySession(studyId: number, sessionId: string): Promise<PostStudyQuestionAnswerResponse[]> {
    const params = new URLSearchParams();
    params.append('user_session_id', sessionId);
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/post-study-question-responses?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Failed to fetch post-study question responses');
    }

    return response.json();
  },
};

// Study Progress API
export interface StudyProgressResponse {
  study_id: number;
  user_session_id: string;
  current_page_type?: 'pre-study' | 'scenario' | 'post-study';
  current_page_number?: number;
  pre_study_completed: boolean;
  scenarios_completed: number;
  total_scenarios: number;
  post_study_completed: boolean;
  study_completed: boolean;
}

export const studyProgressApi = {
  async getProgress(studyId: number, sessionId: string): Promise<StudyProgressResponse> {
    const params = new URLSearchParams();
    params.append('user_session_id', sessionId);
    const response = await fetchWithCredentials(`${API_BASE_URL}/studies/${studyId}/progress?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Failed to fetch study progress');
    }

    return response.json();
  },
};

// Extend userResponseApi with question response method

