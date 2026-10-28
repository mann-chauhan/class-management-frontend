export interface NavigationItem {
    label: string;
    route: string;
    icon: string;
}

export interface NavigationSection {
    title: string;
    items: NavigationItem[];
}

export const NAVIGATION_CONFIG: Record<string, NavigationSection[]> = {

    SUPER_ADMIN: [
        {
            title: 'MAIN',
            items: [
                {
                    label: 'Dashboard',
                    route: '/super-admin/dashboard',
                    icon: '⌂'
                }
            ]
        },
        {
            title: 'MANAGEMENT',
            items: [
                {
                    label: 'Admins',
                    route: '/super-admin/admins',
                    icon: '♙'
                }
            ]
        }
    ],

    ADMIN: [
        {
            title: 'MAIN',
            items: [
                {
                    label: 'Dashboard',
                    route: '/admin/dashboard',
                    icon: '⌂'
                }
            ]
        },
        {
            title: 'INSIDER',
            items: [
                {
                    label: 'Student Insights',
                    route: '/admin/insider/students',
                    icon: '◉'
                },
                {
                    label: 'Fees Insights',
                    route: '/admin/fees-insider',
                    icon: '₹'
                }
            ]
        },
        {
            title: 'ACADEMIC',
            items: [
                {
                    label: 'Academic Management',
                    route: '/admin/academic',
                    icon: '▦'
                }
            ]
        },
        {
            title: 'FEES',
            items: [
                {
                    label: 'Fee Management',
                    route: '/admin/fees',
                    icon: '₹'
                }
            ]
        },
        {
            title: 'MANAGEMENT',
            items: [
                {
                    label: 'Teachers',
                    route: '/admin/teachers',
                    icon: '♙'
                },
                {
                    label: 'Students',
                    route: '/admin/students',
                    icon: '♙'
                },
                {
                    label: 'Exams & Marks',
                    route: '/admin/exams',
                    icon: '▤'
                },
                {
                    label: 'Assignments',
                    route: '/admin/assignments',
                    icon: '≡'
                },
                {
                    label: 'Attendance',
                    route: '/admin/attendance',
                    icon: '✓'
                },
                {
                    label: 'Leave Requests',
                    route: '/admin/leave',
                    icon: '▣'
                },
                {
                    label: 'Advertisements',
                    route: '/admin/advertisements',
                    icon: '▤'
                }
            ]
        }
    ],

    TEACHER: [
        {
            title: 'MAIN',
            items: [
                {
                    label: 'Dashboard',
                    route: '/teacher/dashboard',
                    icon: '⌂'
                }
            ]
        },
        {
            title: 'TEACHING',
            items: [
                {
                    label: 'Exams & Marks',
                    route: '/teacher/exams',
                    icon: '▤'
                },
                {
                    label: 'My Assignments',
                    route: '/teacher/assignments',
                    icon: '≡'
                },
                {
                    label: 'Students',
                    route: '/teacher/students',
                    icon: '♙'
                },
                {
                    label: 'Attendance',
                    route: '/teacher/attendance',
                    icon: '✓'
                },
                {
                    label: 'Leave Management',
                    route: '/teacher/leave',
                    icon: '▣'
                },
                {
                    label: 'Student Leave Reviews',
                    route: '/teacher/leave/review',
                    icon: '✓'
                }
            ]
        }
    ],

    STUDENT: [
        {
            title: 'MAIN',
            items: [
                {
                    label: 'Dashboard',
                    route: '/student/dashboard',
                    icon: '⌂'
                }
            ]
        },
        {
            title: 'MY ACCOUNT',
            items: [
                {
                    label: 'Attendance',
                    route: '/student/attendance',
                    icon: '✓'
                },
                {
                    label: 'Fees',
                    route: '/student/fees',
                    icon: '₹'
                },
                {
                    label: 'Assignments',
                    route: '/student/assignments',
                    icon: '≡'
                },
                {
                    label: 'Exam Results',
                    route: '/student/exams',
                    icon: '▤'
                },
                {
                    label: 'Leave Management',
                    route: '/student/leave',
                    icon: '▣'
                }
            ]
        }
    ]
};
