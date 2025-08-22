import { useState, useEffect, useCallback } from 'react';
import { ReflectionApi, ReflectionApiEntry } from '../services/api/reflectionApi';

export interface JournaledQuestion {
  devotionalId: string;
  dayNumber: number;
  questionNumber: number;
  questionText: string;
  reflectionEntry: ReflectionApiEntry;
}

export const useJournaledQuestions = (userId: string, devotionalId: string) => {
  const [journaledQuestions, setJournaledQuestions] = useState<JournaledQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJournaledQuestions = useCallback(async () => {
    if (!userId || !devotionalId) return;

    setLoading(true);
    try {
      // Search for all reflection entries for this devotional
      const entries = await ReflectionApi.searchReflections({
        userId,
        devotionalId,
        limit: 100, // Get all entries for this devotional
      });

      const journaled = entries
        .filter(entry => 
          entry.devotional_id === devotionalId && 
          entry.question_number !== undefined &&
          entry.question_text
        )
        .map(entry => ({
          devotionalId: entry.devotional_id!,
          dayNumber: entry.day_number || 1,
          questionNumber: entry.question_number!,
          questionText: entry.question_text!,
          reflectionEntry: entry,
        }));


      setJournaledQuestions(journaled);
    } catch (error) {
      console.error('Error fetching journaled questions:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, devotionalId]);

  useEffect(() => {
    fetchJournaledQuestions();
  }, [fetchJournaledQuestions]);

  const isQuestionJournaled = useCallback((dayNumber: number, questionNumber: number): JournaledQuestion | null => {
    return journaledQuestions.find(
      jq => jq.dayNumber === dayNumber && jq.questionNumber === questionNumber
    ) || null;
  }, [journaledQuestions]);

  const getJournaledEntry = useCallback((dayNumber: number, questionNumber: number): ReflectionApiEntry | null => {
    const journaled = isQuestionJournaled(dayNumber, questionNumber);
    return journaled ? journaled.reflectionEntry : null;
  }, [isQuestionJournaled]);

  const addJournaledQuestion = useCallback((entry: ReflectionApiEntry) => {
    if (!entry.devotional_id || entry.question_number === undefined || !entry.question_text) return;

    const newJournaled: JournaledQuestion = {
      devotionalId: entry.devotional_id,
      dayNumber: entry.day_number || 1,
      questionNumber: entry.question_number,
      questionText: entry.question_text,
      reflectionEntry: entry,
    };

    setJournaledQuestions(prev => {
      // Remove any existing entry for this question and add the new one
      const filtered = prev.filter(
        jq => !(jq.dayNumber === newJournaled.dayNumber && jq.questionNumber === newJournaled.questionNumber)
      );
      return [...filtered, newJournaled];
    });
  }, []);

  const updateJournaledQuestion = useCallback((updatedEntry: ReflectionApiEntry) => {
    setJournaledQuestions(prev => 
      prev.map(jq => 
        jq.reflectionEntry.id === updatedEntry.id 
          ? { ...jq, reflectionEntry: updatedEntry }
          : jq
      )
    );
  }, []);

  return {
    journaledQuestions,
    loading,
    isQuestionJournaled,
    getJournaledEntry,
    addJournaledQuestion,
    updateJournaledQuestion,
    refetch: fetchJournaledQuestions,
  };
};
