import unittest
import backend.database as db
import server

class TestTeacherFeatures(unittest.TestCase):
    def setUp(self):
        self.app = server.app.test_client()
        self.app.testing = True
        db.init_db()

    def test_list_teachers(self):
        teachers = db.list_teachers()
        self.assertIsInstance(teachers, list)
        self.assertGreaterEqual(len(teachers), 1)
        self.assertTrue(any(t["username"] == "teacher" for t in teachers))

    def test_create_and_delete_teacher(self):
        temp_username = "test_teacher_auto"
        # Create teacher
        teacher_id = db.create_teacher(temp_username, "Secret123!", "Test Docent Auto", "PXL-SNE")
        self.assertIsInstance(teacher_id, int)
        self.assertGreater(teacher_id, 0)

        # Verify in list
        teachers = db.list_teachers()
        created = next((t for t in teachers if t["username"] == temp_username), None)
        self.assertIsNotNone(created)
        self.assertEqual(created["full_name"], "Test Docent Auto")

        # Delete teacher
        success = db.delete_teacher(created["id"], requesting_user_id=1)
        self.assertTrue(success)

        # Cannot delete self
        with self.assertRaises(ValueError):
            db.delete_teacher(1, requesting_user_id=1)

    def test_labs_catalog(self):
        catalog = db.list_labs_catalog()
        self.assertIsInstance(catalog, list)
        self.assertGreater(len(catalog), 0)
        sample = catalog[0]
        self.assertIn("id", sample)
        self.assertIn("title", sample)
        self.assertIn("instructions", sample)
        self.assertIn("rubric", sample)
        self.assertIsInstance(sample["rubric"], list)
        self.assertIn("rubric_items_count", sample)
        self.assertIn("total_points", sample)

    def test_last_login_tracking(self):
        # Authenticate teacher
        user = db.authenticate_user("teacher", "SinterklaasOp6December")
        self.assertIsNotNone(user)
        # Check last_login_at updated
        updated_user = db.get_user_by_id(user["id"])
        self.assertIsNotNone(updated_user["last_login_at"])

    def test_api_endpoints(self):
        # Test GET /api/teacher/teachers
        res = self.app.get('/api/teacher/teachers')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("teachers", data)

        # Test GET /api/teacher/labs-catalog
        res2 = self.app.get('/api/teacher/labs-catalog')
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        self.assertEqual(data2.get("status"), "success")
        self.assertIn("labs", data2)

        # Test GET /api/teacher/scores
        res3 = self.app.get('/api/teacher/scores')
        self.assertEqual(res3.status_code, 200)
        data3 = res3.get_json()
        self.assertEqual(data3.get("status"), "success")
        self.assertIn("scores", data3)
        if data3["scores"]:
            self.assertIn("last_login_at", data3["scores"][0])

if __name__ == '__main__':
    unittest.main()
