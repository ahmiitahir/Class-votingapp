export type Student = {
  id: string;
  roll_number: string;
  student_name: string;
  password?: string | null;
};

export type StudentTitle = {
  id: string;
  giver_id: string;
  receiver_id: string;
  title_text: string;
  created_at: string;
  giver?: Student;
};

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
};
