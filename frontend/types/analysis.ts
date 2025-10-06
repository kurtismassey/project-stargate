export interface StageAnalysis {
  stage: number;
  summary: string;
  key_elements: string[];
}

export interface SessionAnalysis {
  overall_summary: string;
  stage_by_stage_analysis: StageAnalysis[];
  final_assessment_score: number;
  target_image?: string;

  // Comprehensive scoring metrics (0-7 scale)
  overall_quality_score: number;
  target_accuracy_score: number;
  sensory_details_score: number;
  dimensional_data_score: number;
  emotional_energetic_score: number;
  aol_contamination_score: number;
  consistency_score: number;
  stage_development_score: number;
  composite_score: number;

  // Detailed analysis
  session_strengths: string[];
  session_weaknesses: string[];
  aol_instances: string[];
  target_correlations: string[];
}
