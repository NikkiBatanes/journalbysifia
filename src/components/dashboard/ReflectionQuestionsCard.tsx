/**
 * ReflectionQuestionsCard.tsx
 * Displays reflection questions from user's playbooks and devotionals
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';

interface ReflectionQuestion {
  id: string;
  question: string;
  source: string;
  sourceType: 'playbook' | 'devotional';
  category?: string;
  isAnswered?: boolean;
}

interface ReflectionQuestionsCardProps {
  onQuestionPress?: (question: ReflectionQuestion) => void;
  onViewAll?: () => void;
}



const ReflectionQuestionsCard: React.FC<ReflectionQuestionsCardProps> = ({ 
  onQuestionPress, 
  onViewAll 
}) => {
  const { user } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState<ReflectionQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReflectionQuestions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch user's playbooks and devotionals
      const [playbooksResult, devotionalsResult] = await Promise.all([
        supabase
          .from('playbooks')
          .select('id, title, content')

          .not('content', 'is', null),
        supabase
          .from('devotionals')
          .select('id, title, content')

          .not('content', 'is', null)
      ]);

      const allQuestions: ReflectionQuestion[] = [];

      // Extract questions from playbooks
      if (playbooksResult.data) {
        playbooksResult.data.forEach(playbook => {
          try {
            const content = typeof playbook.content === 'string' 
              ? JSON.parse(playbook.content) 
              : playbook.content;
            
            // Look for reflection questions in various structures
            if (content.reflectionQuestions && Array.isArray(content.reflectionQuestions)) {
              content.reflectionQuestions.forEach((q: any, index: number) => {
                allQuestions.push({
                  id: `playbook-${playbook.id}-${index}`,
                  question: typeof q === 'string' ? q : q.question || q.text,
                  source: playbook.title,
                  sourceType: 'playbook',
                  category: q.category || 'Reflection'
                });
              });
            }
            
            // Look for questions in action steps
            if (content.actionSteps && Array.isArray(content.actionSteps)) {
              content.actionSteps.forEach((step: any, index: number) => {
                if (step.reflectionQuestion || step.question) {
                  allQuestions.push({
                    id: `playbook-step-${playbook.id}-${index}`,
                    question: step.reflectionQuestion || step.question,
                    source: playbook.title,
                    sourceType: 'playbook',
                    category: 'Action Reflection'
                  });
                }
              });
            }
          } catch (parseError) {
            console.warn('Error parsing playbook content:', parseError);
          }
        });
      }

      // Extract questions from devotionals
      if (devotionalsResult.data) {
        devotionalsResult.data.forEach(devotional => {
          try {
            const content = typeof devotional.content === 'string' 
              ? JSON.parse(devotional.content) 
              : devotional.content;
            
            if (content.reflectionQuestions && Array.isArray(content.reflectionQuestions)) {
              content.reflectionQuestions.forEach((q: any, index: number) => {
                allQuestions.push({
                  id: `devotional-${devotional.id}-${index}`,
                  question: typeof q === 'string' ? q : q.question || q.text,
                  source: devotional.title,
                  sourceType: 'devotional',
                  category: q.category || 'Devotional'
                });
              });
            }
            
            // Single reflection question
            if (content.reflectionQuestion) {
              allQuestions.push({
                id: `devotional-single-${devotional.id}`,
                question: content.reflectionQuestion,
                source: devotional.title,
                sourceType: 'devotional',
                category: 'Devotional'
              });
            }
          } catch (parseError) {
            console.warn('Error parsing devotional content:', parseError);
          }
        });
      }

      // Only use questions if found in database
      if (allQuestions.length > 0) {
        // Select question based on current date for consistency
        const today = new Date();
        const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        const selectedIndex = dayOfYear % allQuestions.length;
        
        setCurrentQuestion(allQuestions[selectedIndex]);
      } else {
        setCurrentQuestion(null);
      }

    } catch (err) {
      console.error('Error fetching reflection questions:', err);
      setError('Unable to load reflection questions');
      setCurrentQuestion(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReflectionQuestions();
  }, [user]);

  const handleRefresh = () => {
    fetchReflectionQuestions();
  };

  const getSourceIcon = (sourceType: 'playbook' | 'devotional') => {
    return sourceType === 'playbook' ? 'library' : 'book';
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="bulb" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>Reflection Questions</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.alertCoral} />
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="bulb" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Reflection Questions</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onViewAll} style={styles.actionButton}>
            <Text style={styles.viewAllText}>More</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} style={styles.actionButton}>
            <Ionicons name="refresh" size={18} color={Colors.mediumGray} />
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : currentQuestion ? (
        <TouchableOpacity
          style={styles.questionContainer}
          onPress={() => onQuestionPress?.(currentQuestion)}
          activeOpacity={0.8}
        >
          <Text style={styles.questionText}>
            {currentQuestion.question}
          </Text>
          
          <View style={styles.questionFooter}>
            <View style={styles.sourceInfo}>
              <Ionicons 
                name={getSourceIcon(currentQuestion.sourceType)} 
                size={14} 
                color={Colors.mediumGray} 
              />
              <Text style={styles.sourceText}>
                {currentQuestion.source}
              </Text>
            </View>
            
            {currentQuestion.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>
                  {currentQuestion.category}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap to reflect</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.alertCoral} />
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.alertCoral,
    fontWeight: '500',
  },
  questionContainer: {
    flex: 1,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    marginBottom: 16,
    fontWeight: '500',
  },
  questionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceText: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    color: Colors.lightGray,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  tapHintText: {
    fontSize: 12,
    color: Colors.alertCoral,
    fontWeight: '500',
  },
  loadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  errorContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.alertCoral,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
});

export default ReflectionQuestionsCard;
