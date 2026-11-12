"""
Unit & Integration Test for Exam Deletion, Bulk Delete, All Scores Export, and Student Score View
"""
import sys
import os
import json
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import (
    init_db,
    save_exam,
    delete_exam,
    delete_exams_bulk,
    list_exams,
    create_or_update_user,
    save_student_progress,
    list_all_student_scores,
    get_scores_for_student
)
import server

class TestExamDeletionAndScores(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = server.app.test_client()

    def test_01_save_and_list_exams_with_score_counts(self):
        # Create a test exam
        exam_id_1 = "test_exam_del_1"
        save_exam(
            exam_id=exam_id_1,
            title="Test Examen 1",
            instructions="Doe iets",
            topology={"devices": []},
            rubric=[],
            time_limit_minutes=60,
            category="custom",
            created_by="teacher"
        )

        exams = list_exams()
        found = [e for e in exams if e["id"] == exam_id_1]
        self.assertTrue(len(found) > 0)
        self.assertEqual(found[0]["scored_count"], 0)
        self.assertEqual(found[0]["total_saves"], 0)

        # Create student and progress
        uid = create_or_update_user("test_student_score1", "Pass123!", "Test Student Een", role="student", class_group="1SNE-A")
        save_student_progress(uid, exam_id_1, {"devices": []}, score=85, max_score=100, percentage=85.0)

        # Re-check list_exams
        exams = list_exams()
        found = [e for e in exams if e["id"] == exam_id_1]
        self.assertEqual(found[0]["scored_count"], 1)
        self.assertEqual(found[0]["total_saves"], 1)
        self.assertEqual(found[0]["max_student_score"], 85)

    def test_02_delete_single_exam_cleans_cascade(self):
        exam_id = "test_exam_del_cascade"
        save_exam(exam_id, "Cascade Exam", "...", {}, [], 60, "custom", "teacher")
        uid = create_or_update_user("test_student_casc", "Pass123!", "Test Student Casc", role="student", class_group="1SNE-B")
        save_student_progress(uid, exam_id, {}, 50, 100, 50.0)

        res = self.client.post("/api/teacher/exam/delete", json={"id": exam_id})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()["success"])

        # Check exam is gone
        exams = list_exams()
        self.assertFalse(any(e["id"] == exam_id for e in exams))

        # Check student scores for this exam is gone
        scores = get_scores_for_student(uid)
        self.assertFalse(any(s["exam_id"] == exam_id for s in scores))

    def test_03_bulk_delete_exams(self):
        e1 = "bulk_exam_1"
        e2 = "bulk_exam_2"
        save_exam(e1, "Bulk 1", "...", {}, [], 45, "custom", "teacher")
        save_exam(e2, "Bulk 2", "...", {}, [], 45, "custom", "teacher")

        res = self.client.post("/api/teacher/exam/delete-bulk", json={"ids": [e1, e2]})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["count"], 2)

        exams = list_exams()
        self.assertFalse(any(e["id"] in [e1, e2] for e in exams))

    def test_04_scores_all_and_csv_export(self):
        # Create student with saves
        e_test = "exam_all_scores_test"
        save_exam(e_test, "All Scores Test", "...", {}, [], 60, "custom", "teacher")
        uid = create_or_update_user("student_for_all_export", "PXL2026!", "Jan De Student", role="student", class_group="1SNE-Z")
        save_student_progress(uid, e_test, {}, 92, 100, 92.0)

        # GET /api/teacher/scores?exam_id=all
        res = self.client.get("/api/teacher/scores?exam_id=all")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["exam_id"], "all")
        self.assertTrue(len(data["scores"]) > 0)
        user_rows = [s for s in data["scores"] if s["username"] == "student_for_all_export"]
        self.assertEqual(len(user_rows), 1)
        self.assertEqual(user_rows[0]["score"], 92)

        # GET /api/teacher/scores/export?exam_id=all
        res_exp = self.client.get("/api/teacher/scores/export?exam_id=all")
        self.assertEqual(res_exp.status_code, 200)
        csv_bytes = res_exp.data
        self.assertTrue(csv_bytes.startswith(b"\xef\xbb\xbf"))  # UTF-8 BOM
        csv_text = csv_bytes.decode("utf-8-sig")
        self.assertIn("Achternaam;Voornaam;Gebruikersnaam;Richting;Klas;ExamenId;ExamenTitel;Categorie;Score;MaxScore;Percentage;LaatsteOpslag", csv_text)
        self.assertIn("student_for_all_export", csv_text)
        self.assertIn("All Scores Test", csv_text)

    def test_05_student_scores_endpoint(self):
        # Test student viewing their own scores via session or username param
        uid = create_or_update_user("test_student_me", "PXL2026!", "Klaas Me", role="student", class_group="1SNE-C")
        e_me = "exam_me_test"
        save_exam(e_me, "Student Me Examen", "...", {}, [], 60, "custom", "teacher")
        save_student_progress(uid, e_me, {}, 78, 100, 78.0)

        # Call with username query param
        res = self.client.get(f"/api/student/scores?username=test_student_me")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(len(data["scores"]) >= 1)
        score_item = next(s for s in data["scores"] if s["exam_id"] == e_me)
        self.assertEqual(score_item["score"], 78)
        self.assertEqual(score_item["title"], "Student Me Examen")

if __name__ == "__main__":
    unittest.main()
